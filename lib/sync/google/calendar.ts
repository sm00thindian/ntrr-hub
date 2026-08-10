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

/** v4: normalize primary alias + dedupe double-synced primary events */
const CALENDAR_SYNC_VERSION = 4;

function getCalendarPullWindow() {
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 90);
  return { rangeStart, rangeEnd };
}

function buildInitialCalendarPath(calendarId: string, rangeStart: Date, rangeEnd: Date) {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
  });
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
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

  const path = syncToken
    ? `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?syncToken=${encodeURIComponent(syncToken)}`
    : buildInitialCalendarPath(calendarId, rangeStart, rangeEnd);

  let payload: {
    items?: GoogleEvent[];
    nextSyncToken?: string;
  };

  try {
    payload = (await googleFetch(account, path)) as typeof payload;
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 410) {
      return pullGoogleCalendarEvents(account, calendarId, calendarName, undefined);
    }
    throw error;
  }

  for (const item of payload.items ?? []) {
    if (!item.id) {
      continue;
    }

    const mappingExternalId = toGoogleCalendarMappingId(calendarId, item.id);

    const { data: mapping } = await admin
      .from("sync_mappings")
      .select("id, ntrr_id, external_etag")
      .eq("household_id", householdId)
      .eq("provider", "google")
      .eq("entity_type", "calendar_event")
      .eq("external_id", mappingExternalId)
      .maybeSingle();

    if (item.status === "cancelled") {
      if (mapping?.ntrr_id) {
        await admin.from("calendar_events").delete().eq("id", mapping.ntrr_id);
        await admin.from("sync_mappings").delete().eq("id", mapping.id);
      }
      continue;
    }

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

  return payload.nextSyncToken;
}

export async function pullGoogleCalendar(account: IntegrationAccount) {
  const admin = createAdminClient();
  const googleState = account.metadata.google ?? {};
  const needsResync = (googleState.calendarSyncVersion ?? 1) < CALENDAR_SYNC_VERSION;

  let calendars = googleState.calendars;
  if (!calendars?.length) {
    calendars = await fetchGoogleCalendarList(account);
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