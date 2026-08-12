import { decryptJson } from "@/lib/integrations/crypto";
import {
  discoverPrimaryCalendarUrl,
  fetchCalDavEvents,
} from "@/lib/integrations/apple/caldav-client";
import type {
  AppleCalDavCredentials,
  IntegrationAccount,
  IntegrationMetadata,
} from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";

function getAppleCredentials(metadata: IntegrationMetadata): AppleCalDavCredentials | null {
  const raw = metadata.apple?.credentials;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return decryptJson<AppleCalDavCredentials>(raw);
  }
  return raw;
}

function syncProvenance(uid: string, integrationId: string, calendarName?: string) {
  return {
    source: "apple_caldav" as const,
    externalId: uid,
    /** Used for household vs personal visibility (ADR 0002) */
    calendarId: `apple:${integrationId}`,
    calendarName: calendarName ?? "Apple Calendar",
    syncedAt: new Date().toISOString(),
    confidence: "high" as const,
    lastModifiedBy: "sync" as const,
  };
}

export async function pullAppleCalDavCalendar(account: IntegrationAccount) {
  const credentials = getAppleCredentials(account.metadata);
  if (!credentials) {
    throw new Error("Apple CalDAV credentials are missing. Reconnect Apple.");
  }

  let calendarUrl = account.metadata.apple?.caldav?.calendarUrl;
  let calendarName = account.metadata.apple?.caldav?.calendarName;

  if (!calendarUrl) {
    const discovered = await discoverPrimaryCalendarUrl(
      credentials.appleId,
      credentials.appPassword,
    );
    calendarUrl = discovered.calendarUrl;
    calendarName = discovered.calendarName;
  }

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 30);

  const events = await fetchCalDavEvents(
    credentials.appleId,
    credentials.appPassword,
    calendarUrl,
    rangeStart,
    rangeEnd,
  );

  const admin = createAdminClient();
  const householdId = account.householdId;

  const { data: integrationRow } = await admin
    .from("integration_accounts")
    .select("created_by")
    .eq("id", account.id)
    .maybeSingle();

  const createdBy = integrationRow?.created_by as string | undefined;

  for (const event of events) {
    const { data: mapping } = await admin
      .from("sync_mappings")
      .select("id, ntrr_id")
      .eq("household_id", householdId)
      .eq("provider", "apple_caldav")
      .eq("entity_type", "calendar_event")
      .eq("external_id", event.uid)
      .maybeSingle();

    const row = {
      household_id: householdId,
      title: event.title,
      description: event.description ?? null,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      all_day: event.allDay,
      location: event.location ?? null,
      provenance: syncProvenance(event.uid, account.id, calendarName),
      created_by: createdBy ?? null,
      updated_at: new Date().toISOString(),
    };

    if (mapping?.ntrr_id) {
      await admin.from("calendar_events").update(row).eq("id", mapping.ntrr_id);
      await admin
        .from("sync_mappings")
        .update({
          external_etag: event.etag ?? null,
          external_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.id);
      continue;
    }

    const { data: created } = await admin
      .from("calendar_events")
      .insert(row)
      .select("id")
      .single();

    if (created?.id) {
      await admin.from("sync_mappings").insert({
        household_id: householdId,
        provider: "apple_caldav",
        entity_type: "calendar_event",
        ntrr_id: created.id,
        external_id: event.uid,
        external_etag: event.etag ?? null,
        external_updated_at: new Date().toISOString(),
      });
    }
  }

  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        apple: {
          ...account.metadata.apple,
          caldav: {
            calendarUrl,
            calendarName,
            lastSyncedAt: new Date().toISOString(),
          },
        },
      },
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
}