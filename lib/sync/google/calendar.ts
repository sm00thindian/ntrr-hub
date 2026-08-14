import {
  fetchGoogleCalendarList,
  getSelectedGoogleCalendarIds,
  googleEventIdFromMappingExternalId,
  parseGoogleCalendarMappingId,
  persistGoogleCalendarMetadata,
  resolveGooglePrimaryCalendarId,
  toGoogleCalendarMappingId,
} from "@/lib/integrations/google/calendars";
import { GoogleApiError, googleFetch } from "@/lib/integrations/google/client";
import type { IntegrationAccount } from "@/lib/integrations/types";
import { recordSyncConflict } from "@/lib/sync/conflict";
import { createAdminClient } from "@/lib/supabase/admin";

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  etag?: string;
  updated?: string;
  status?: string;
};

/**
 * v5: delete cancelled recurring series instances; reconcile missing events after full pull
 * (Google omits deleted events from ranged lists — they only appear as cancelled on incremental sync).
 */
const CALENDAR_SYNC_VERSION = 5;

function getCalendarPullWindow() {
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 90);
  return { rangeStart, rangeEnd };
}

function buildInitialCalendarPath(
  calendarId: string,
  rangeStart: Date,
  rangeEnd: Date,
  pageToken?: string,
) {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
  });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
}

function buildIncrementalCalendarPath(calendarId: string, syncToken: string, pageToken?: string) {
  const params = new URLSearchParams({
    syncToken,
    maxResults: "2500",
    // singleEvents not allowed with syncToken; Google returns cancelled rows for deletes
  });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
}

/**
 * Remove Hub rows for a cancelled Google event. Also drops expanded recurring
 * instances when the master series id is cancelled (`id` / `id_YYYYMMDD...`).
 */
async function deleteCancelledGoogleEvents(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
  calendarId: string,
  googleEventId: string,
) {
  const exactExternalId = toGoogleCalendarMappingId(calendarId, googleEventId);

  const { data: mappings } = await admin
    .from("sync_mappings")
    .select("id, ntrr_id, external_id")
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("entity_type", "calendar_event")
    .like("external_id", `${calendarId}:%`);

  const toRemove = (mappings ?? []).filter((row) => {
    const externalId = row.external_id as string;
    if (externalId === exactExternalId) {
      return true;
    }
    // Expanded instances of a recurring series: masterId_YYYYMMDDTHHMMSSZ
    const { eventId } = parseGoogleCalendarMappingId(externalId);
    return eventId === googleEventId || eventId.startsWith(`${googleEventId}_`);
  });

  if (!toRemove.length) {
    return;
  }

  const eventIds = toRemove
    .map((row) => row.ntrr_id as string | null)
    .filter((id): id is string => Boolean(id));
  const mappingIds = toRemove.map((row) => row.id as string);

  if (eventIds.length) {
    await admin.from("calendar_events").delete().in("id", eventIds);
  }
  if (mappingIds.length) {
    await admin.from("sync_mappings").delete().in("id", mappingIds);
  }
}

/**
 * After a full ranged pull, drop Hub events for this calendar that are in-window
 * but were not returned by Google (deleted series/instances without a cancelled row).
 */
async function reconcileMissingGoogleEvents(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
  calendarId: string,
  rangeStart: Date,
  rangeEnd: Date,
  seenExternalIds: Set<string>,
) {
  const { data: mappings } = await admin
    .from("sync_mappings")
    .select("id, ntrr_id, external_id")
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("entity_type", "calendar_event")
    .like("external_id", `${calendarId}:%`);

  const missing = (mappings ?? []).filter(
    (row) => row.external_id && !seenExternalIds.has(row.external_id as string),
  );
  if (!missing.length) {
    return;
  }

  const ntrrIds = missing
    .map((row) => row.ntrr_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (!ntrrIds.length) {
    return;
  }

  // Only remove events that fall inside the pull window (we did not list outside it)
  const { data: inWindow } = await admin
    .from("calendar_events")
    .select("id")
    .in("id", ntrrIds)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());

  const deleteEventIds = (inWindow ?? []).map((row) => row.id as string);
  if (!deleteEventIds.length) {
    return;
  }

  const deleteIdSet = new Set(deleteEventIds);
  const deleteMappingIds = missing
    .filter((row) => row.ntrr_id && deleteIdSet.has(row.ntrr_id as string))
    .map((row) => row.id as string);

  await admin.from("calendar_events").delete().in("id", deleteEventIds);
  if (deleteMappingIds.length) {
    await admin.from("sync_mappings").delete().in("id", deleteMappingIds);
  }
}

function eventProvenance(
  event: GoogleEvent,
  calendarId: string,
  calendarName: string,
) {
  return {
    source: "google" as const,
    externalId: event.id,
    calendarId,
    calendarName,
    syncedAt: new Date().toISOString(),
    confidence: "high" as const,
    lastModifiedBy: "sync" as const,
  };
}

function parseEventTimes(event: GoogleEvent) {
  const allDay = Boolean(event.start?.date);
  const startsAt = event.start?.dateTime ?? event.start?.date;
  const endsAt = event.end?.dateTime ?? event.end?.date;

  if (!startsAt || !endsAt) {
    return null;
  }

  return {
    allDay,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };
}

function migrateSyncTokens(
  googleState: NonNullable<IntegrationAccount["metadata"]["google"]>,
  primaryId: string,
) {
  const tokens = { ...(googleState.calendarSyncTokens ?? {}) };

  if (googleState.calendarSyncToken && !tokens[primaryId] && !tokens.primary) {
    tokens[primaryId] = googleState.calendarSyncToken;
  }

  // Move alias token onto real primary id
  if (tokens.primary && primaryId !== "primary") {
    if (!tokens[primaryId]) {
      tokens[primaryId] = tokens.primary;
    }
    delete tokens.primary;
  }

  return tokens;
}

/**
 * When the same Google event was synced once as primary:id and again as
 * realCalendarId:id, keep the canonical mapping and drop the duplicate Hub row.
 */
async function dedupePrimaryAliasEvents(householdId: string, primaryId: string) {
  if (primaryId === "primary") {
    return;
  }

  const admin = createAdminClient();
  const { data: mappings } = await admin
    .from("sync_mappings")
    .select("id, ntrr_id, external_id")
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("entity_type", "calendar_event");

  if (!mappings?.length) {
    return;
  }

  const byEventId = new Map<string, typeof mappings>();

  for (const mapping of mappings) {
    const externalId = mapping.external_id as string;
    const eventId = googleEventIdFromMappingExternalId(externalId);
    const list = byEventId.get(eventId) ?? [];
    list.push(mapping);
    byEventId.set(eventId, list);
  }

  for (const group of byEventId.values()) {
    if (group.length < 2) {
      continue;
    }

    const preferred =
      group.find((row) => (row.external_id as string).startsWith(`${primaryId}:`)) ??
      group.find((row) => (row.external_id as string).startsWith("primary:")) ??
      group[0]!;

    for (const row of group) {
      if (row.id === preferred.id) {
        continue;
      }

      if (row.ntrr_id) {
        await admin.from("calendar_events").delete().eq("id", row.ntrr_id);
      }
      await admin.from("sync_mappings").delete().eq("id", row.id);
    }

    // Prefer real primary id on the survivor
    const preferredExternal = preferred.external_id as string;
    if (preferredExternal.startsWith("primary:")) {
      const eventId = googleEventIdFromMappingExternalId(preferredExternal);
      await admin
        .from("sync_mappings")
        .update({
          external_id: toGoogleCalendarMappingId(primaryId, eventId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", preferred.id);

      const { data: eventRow } = await admin
        .from("calendar_events")
        .select("provenance")
        .eq("id", preferred.ntrr_id)
        .maybeSingle();

      if (eventRow?.provenance && preferred.ntrr_id) {
        const provenance = eventRow.provenance as Record<string, unknown>;
        await admin
          .from("calendar_events")
          .update({
            provenance: {
              ...provenance,
              calendarId: primaryId,
            },
          })
          .eq("id", preferred.ntrr_id);
      }
    }
  }
}

async function pullGoogleCalendarEvents(
  account: IntegrationAccount,
  calendarId: string,
  calendarName: string,
  syncToken: string | undefined,
) {
  const admin = createAdminClient();
  const householdId = account.householdId;
  const { rangeStart, rangeEnd } = getCalendarPullWindow();
  const isFullPull = !syncToken;

  type ListPayload = {
    items?: GoogleEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  };

  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const path = syncToken
        ? buildIncrementalCalendarPath(calendarId, syncToken, pageToken)
        : buildInitialCalendarPath(calendarId, rangeStart, rangeEnd, pageToken);

      const payload = (await googleFetch(account, path)) as ListPayload;
      if (payload.items?.length) {
        items.push(...payload.items);
      }
      pageToken = payload.nextPageToken;
      if (payload.nextSyncToken) {
        nextSyncToken = payload.nextSyncToken;
      }
    } while (pageToken);
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 410) {
      // Token expired — full resync + reconcile
      return pullGoogleCalendarEvents(account, calendarId, calendarName, undefined);
    }
    throw error;
  }

  const seenExternalIds = new Set<string>();

  for (const item of items) {
    if (!item.id) {
      continue;
    }

    const mappingExternalId = toGoogleCalendarMappingId(calendarId, item.id);

    if (item.status === "cancelled") {
      await deleteCancelledGoogleEvents(admin, householdId, calendarId, item.id);
      continue;
    }

    seenExternalIds.add(mappingExternalId);

    const { data: mapping } = await admin
      .from("sync_mappings")
      .select("id, ntrr_id, external_etag")
      .eq("household_id", householdId)
      .eq("provider", "google")
      .eq("entity_type", "calendar_event")
      .eq("external_id", mappingExternalId)
      .maybeSingle();

    const times = parseEventTimes(item);
    if (!times) {
      continue;
    }

    const title = item.summary ?? "Untitled event";
    const remoteUpdatedAt = item.updated ? new Date(item.updated).toISOString() : null;
    const provenance = eventProvenance(item, calendarId, calendarName);

    if (mapping?.ntrr_id) {
      const { data: localEvent } = await admin
        .from("calendar_events")
        .select("title, starts_at, ends_at, updated_at")
        .eq("id", mapping.ntrr_id)
        .maybeSingle();

      if (
        localEvent &&
        mapping.external_etag &&
        item.etag &&
        mapping.external_etag !== item.etag &&
        new Date(localEvent.updated_at).getTime() > new Date(item.updated ?? 0).getTime()
      ) {
        await recordSyncConflict({
          householdId,
          provider: "google",
          entityType: "calendar_event",
          entityId: mapping.ntrr_id,
          fieldName: "title",
          localValue: localEvent.title,
          remoteValue: title,
        });
        continue;
      }

      await admin
        .from("calendar_events")
        .update({
          title,
          description: item.description ?? null,
          location: item.location ?? null,
          starts_at: times.startsAt,
          ends_at: times.endsAt,
          all_day: times.allDay,
          provenance,
        })
        .eq("id", mapping.ntrr_id);

      await admin
        .from("sync_mappings")
        .update({
          external_etag: item.etag ?? null,
          external_updated_at: remoteUpdatedAt,
        })
        .eq("id", mapping.id);
    } else {
      const { data: created } = await admin
        .from("calendar_events")
        .insert({
          household_id: householdId,
          title,
          description: item.description ?? null,
          location: item.location ?? null,
          starts_at: times.startsAt,
          ends_at: times.endsAt,
          all_day: times.allDay,
          provenance,
        })
        .select("id")
        .single();

      if (created?.id) {
        await admin.from("sync_mappings").insert({
          household_id: householdId,
          provider: "google",
          entity_type: "calendar_event",
          ntrr_id: created.id,
          external_id: mappingExternalId,
          external_etag: item.etag ?? null,
          external_updated_at: remoteUpdatedAt,
        });
      }
    }
  }

  // Full pull does not list deleted events — remove Hub rows that disappeared from Google
  if (isFullPull) {
    await reconcileMissingGoogleEvents(
      admin,
      householdId,
      calendarId,
      rangeStart,
      rangeEnd,
      seenExternalIds,
    );
  }

  return nextSyncToken;
}

export async function pullGoogleCalendar(
  account: IntegrationAccount,
  options?: { forceFull?: boolean },
) {
  const admin = createAdminClient();
  const googleState = account.metadata.google ?? {};
  const needsResync =
    options?.forceFull === true ||
    (googleState.calendarSyncVersion ?? 1) < CALENDAR_SYNC_VERSION;

  // Always refresh the calendar list so newly shared family calendars appear
  let calendars: Awaited<ReturnType<typeof fetchGoogleCalendarList>>;
  try {
    calendars = await fetchGoogleCalendarList(account);
  } catch (error) {
    calendars = googleState.calendars ?? [];
    if (!calendars.length) {
      throw error;
    }
  }

  // Account with freshest calendar list so primary resolution works
  const accountWithCalendars: IntegrationAccount = {
    ...account,
    metadata: {
      ...account.metadata,
      google: {
        ...googleState,
        calendars,
      },
    },
  };

  const primaryId = resolveGooglePrimaryCalendarId(accountWithCalendars);
  const selectedCalendarIds = getSelectedGoogleCalendarIds(accountWithCalendars);
  const calendarNameById = new Map(calendars.map((calendar) => [calendar.id, calendar.summary]));

  let syncTokens = migrateSyncTokens(googleState, primaryId);
  if (needsResync) {
    // Full pull of every selected calendar (manual Sync now, or version bump)
    syncTokens = {};
    await dedupePrimaryAliasEvents(account.householdId, primaryId);
  }

  const nextSyncTokens: Record<string, string> = { ...syncTokens };

  for (const calendarId of selectedCalendarIds) {
    const resolvedId = calendarId === "primary" ? primaryId : calendarId;
    const calendarName =
      calendarNameById.get(resolvedId) ??
      (resolvedId === primaryId ? "Primary" : resolvedId);
    const syncToken =
      needsResync ? undefined : (syncTokens[resolvedId] ?? syncTokens[calendarId]);
    const nextToken = await pullGoogleCalendarEvents(
      accountWithCalendars,
      resolvedId,
      calendarName,
      syncToken,
    );

    if (nextToken) {
      nextSyncTokens[resolvedId] = nextToken;
      delete nextSyncTokens.primary;
    }
  }

  const nextGoogleState = {
    ...googleState,
    calendars,
    selectedCalendarIds,
    calendarSyncVersion: CALENDAR_SYNC_VERSION,
    calendarSyncTokens: nextSyncTokens,
    calendarSyncToken: undefined,
  };

  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        google: nextGoogleState,
      },
    })
    .eq("id", account.id);

  await persistGoogleCalendarMetadata(
    { ...account, metadata: { ...account.metadata, google: nextGoogleState } },
    calendars,
    selectedCalendarIds,
  );
}

function getPushCalendarId(account: IntegrationAccount) {
  const selected = getSelectedGoogleCalendarIds(account);
  const primary = account.metadata.google?.calendars?.find((calendar) => calendar.primary)?.id;
  return primary && selected.includes(primary) ? primary : selected[0] ?? "primary";
}

export async function pushGoogleCalendarEvent(
  account: IntegrationAccount,
  entry: {
    entityId: string;
    operation: "create" | "update" | "delete";
    payload: Record<string, unknown>;
  },
) {
  const admin = createAdminClient();
  const householdId = account.householdId;
  const pushCalendarId = getPushCalendarId(account);

  const { data: mapping } = await admin
    .from("sync_mappings")
    .select("id, external_id, external_etag")
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("entity_type", "calendar_event")
    .eq("ntrr_id", entry.entityId)
    .maybeSingle();

  if (entry.operation === "delete") {
    if (!mapping?.external_id) {
      return;
    }

    const { calendarId, eventId } = parseGoogleCalendarMappingId(mapping.external_id);
    const targetCalendarId = calendarId === "primary" && !mapping.external_id.includes(":")
      ? pushCalendarId
      : calendarId;

    try {
      await googleFetch(
        account,
        `/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", etag: mapping.external_etag ?? undefined },
      );
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 412) {
        await recordSyncConflict({
          householdId,
          provider: "google",
          entityType: "calendar_event",
          entityId: entry.entityId,
          fieldName: "delete",
          localValue: { deleted: true },
          remoteValue: { deleted: false },
        });
      } else {
        throw error;
      }
    }
    return;
  }

  const title = String(entry.payload.title ?? "Untitled event");
  const startsAt = String(entry.payload.startsAt ?? new Date().toISOString());
  const endsAt = String(entry.payload.endsAt ?? new Date(Date.now() + 3_600_000).toISOString());
  const allDay = Boolean(entry.payload.allDay);

  const body = {
    summary: title,
    description: entry.payload.description ?? undefined,
    location: entry.payload.location ?? undefined,
    start: allDay ? { date: startsAt.slice(0, 10) } : { dateTime: startsAt },
    end: allDay ? { date: endsAt.slice(0, 10) } : { dateTime: endsAt },
  };

  if (mapping?.external_id) {
    const { calendarId, eventId } = parseGoogleCalendarMappingId(mapping.external_id);
    const targetCalendarId = calendarId === "primary" && !mapping.external_id.includes(":")
      ? pushCalendarId
      : calendarId;

    try {
      const updated = (await googleFetch(
        account,
        `/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          etag: mapping.external_etag ?? undefined,
        },
      )) as GoogleEvent;

      await admin
        .from("sync_mappings")
        .update({
          external_etag: updated.etag ?? null,
          external_updated_at: updated.updated ? new Date(updated.updated).toISOString() : null,
        })
        .eq("id", mapping.id);
    } catch (error) {
      if (error instanceof GoogleApiError && (error.status === 412 || error.status === 409)) {
        await recordSyncConflict({
          householdId,
          provider: "google",
          entityType: "calendar_event",
          entityId: entry.entityId,
          fieldName: "title",
          localValue: title,
          remoteValue: "Remote copy changed on Google",
        });
      } else {
        throw error;
      }
    }
    return;
  }

  const created = (await googleFetch(
    account,
    `/calendar/v3/calendars/${encodeURIComponent(pushCalendarId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )) as GoogleEvent;

  if (!created.id) {
    return;
  }

  await admin.from("sync_mappings").upsert(
    {
      household_id: householdId,
      provider: "google",
      entity_type: "calendar_event",
      ntrr_id: entry.entityId,
      external_id: toGoogleCalendarMappingId(pushCalendarId, created.id),
      external_etag: created.etag ?? null,
      external_updated_at: created.updated ? new Date(created.updated).toISOString() : null,
    },
    { onConflict: "household_id,provider,entity_type,ntrr_id" },
  );
}