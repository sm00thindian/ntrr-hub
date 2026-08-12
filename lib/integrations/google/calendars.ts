import { googleFetch } from "@/lib/integrations/google/client";
import {
  getAllConnectedGoogleIntegrationsAdmin,
  getConnectedGoogleIntegrationAdmin,
  getConnectedGoogleIntegrationAdminForUser,
} from "@/lib/integrations/queries";
import type { GoogleCalendarInfo, IntegrationAccount } from "@/lib/integrations/types";
import { memberDisplayLabel } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/** A Google calendar already selected for sync by another household member. */
export type HouseholdCalendarInUse = {
  calendarId: string;
  connectedByUserId: string;
  /** Short label for UI, e.g. "Alex" or email local-part */
  connectedByLabel: string;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    primary?: boolean;
    backgroundColor?: string;
    accessRole?: string;
    selected?: boolean;
  }>;
};

/** Resolve Google's "primary" alias to the real calendar list id when known. */
export function resolveGooglePrimaryCalendarId(account: IntegrationAccount): string {
  const fromList = account.metadata.google?.calendars?.find((calendar) => calendar.primary)?.id;
  return fromList ?? "primary";
}

/**
 * Selected calendars for sync. Never return both "primary" and the real primary id —
 * that double-pulls the same events and creates duplicate Hub rows.
 */
export function getSelectedGoogleCalendarIds(account: IntegrationAccount): string[] {
  const primaryId = resolveGooglePrimaryCalendarId(account);
  const raw = account.metadata.google?.selectedCalendarIds;

  if (!raw?.length) {
    return [primaryId];
  }

  const normalized = raw.map((id) => (id === "primary" ? primaryId : id));
  return [...new Set(normalized)];
}

export function toGoogleCalendarMappingId(calendarId: string, eventId: string) {
  const resolved =
    calendarId === "primary" ? calendarId : calendarId; // caller should pass resolved id
  return `${resolved}:${eventId}`;
}

export function parseGoogleCalendarMappingId(externalId: string) {
  const separator = externalId.indexOf(":");
  if (separator === -1) {
    return { calendarId: "primary", eventId: externalId };
  }

  return {
    calendarId: externalId.slice(0, separator),
    eventId: externalId.slice(separator + 1),
  };
}

/** Google event id from a mapping external_id (handles calendarId:eventId and legacy bare ids). */
export function googleEventIdFromMappingExternalId(externalId: string): string {
  return parseGoogleCalendarMappingId(externalId).eventId;
}

export async function fetchGoogleCalendarList(
  account: IntegrationAccount,
): Promise<GoogleCalendarInfo[]> {
  const payload = (await googleFetch(
    account,
    "/calendar/v3/users/me/calendarList?minAccessRole=reader&showHidden=false",
  )) as GoogleCalendarListResponse;

  return (payload.items ?? [])
    .filter((item) => item.id && item.summary)
    .map((item) => ({
      id: item.id,
      summary: item.summary ?? "Untitled calendar",
      primary: item.primary,
      backgroundColor: item.backgroundColor,
    }))
    .sort((left, right) => {
      if (left.primary) return -1;
      if (right.primary) return 1;
      return left.summary.localeCompare(right.summary);
    });
}

export async function persistGoogleCalendarMetadata(
  account: IntegrationAccount,
  calendars: GoogleCalendarInfo[],
  selectedCalendarIds?: string[],
) {
  const admin = createAdminClient();
  const googleState = account.metadata.google ?? {};
  const primaryId = calendars.find((calendar) => calendar.primary)?.id ?? "primary";

  const nextSelected =
    selectedCalendarIds ??
    (googleState.selectedCalendarIds?.length
      ? googleState.selectedCalendarIds.filter((id) =>
          id === "primary"
            ? true
            : calendars.some((calendar) => calendar.id === id),
        )
      : [primaryId]);

  // Collapse primary alias + real id into a single selection
  const collapsed = nextSelected.map((id) => (id === "primary" ? primaryId : id));
  const deduped = [...new Set(collapsed.filter(Boolean))];
  const safeSelected = deduped.length ? deduped : [primaryId];

  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        google: {
          ...googleState,
          calendars,
          selectedCalendarIds: safeSelected,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return safeSelected;
}

export async function getGoogleCalendarSettings(householdId: string, userId?: string) {
  const account = userId
    ? await getConnectedGoogleIntegrationAdminForUser(householdId, userId)
    : await getConnectedGoogleIntegrationAdmin(householdId);
  if (!account) {
    return null;
  }

  const calendars = await fetchGoogleCalendarList(account);
  const selectedCalendarIds = getSelectedGoogleCalendarIds(account).filter((id) =>
    calendars.some((calendar) => calendar.id === id),
  );
  const safeSelected = selectedCalendarIds.length
    ? selectedCalendarIds
    : [calendars.find((calendar) => calendar.primary)?.id ?? "primary"];

  await persistGoogleCalendarMetadata(account, calendars, safeSelected);

  return {
    calendars,
    selectedCalendarIds: safeSelected,
    connectedByUserId: account.createdBy,
  };
}

/**
 * Google calendar ids already selected for household sync by someone other than
 * `excludeUserId`. Used so care partners don't re-add a shared Family calendar
 * that the coordinator already syncs.
 */
export async function getGoogleCalendarsAlreadyInHousehold(
  householdId: string,
  excludeUserId: string,
): Promise<Record<string, HouseholdCalendarInUse>> {
  const [accounts, members] = await Promise.all([
    getAllConnectedGoogleIntegrationsAdmin(householdId),
    getHouseholdMembers(householdId),
  ]);

  const labelByUserId = new Map(
    members.map((m) => [m.userId, memberDisplayLabel(m.email, m.displayName)] as const),
  );

  const inUse: Record<string, HouseholdCalendarInUse> = {};

  for (const account of accounts) {
    if (account.createdBy === excludeUserId) {
      continue;
    }
    if (account.status !== "connected") {
      continue;
    }

    const selected = getSelectedGoogleCalendarIds(account);
    const label =
      labelByUserId.get(account.createdBy) ??
      account.metadata.tokens?.connectedEmail?.split("@")[0] ??
      "another member";

    for (const calendarId of selected) {
      if (!calendarId || inUse[calendarId]) {
        continue;
      }
      inUse[calendarId] = {
        calendarId,
        connectedByUserId: account.createdBy,
        connectedByLabel: label,
      };
    }
  }

  return inUse;
}

export async function removeSyncedEventsForCalendars(
  householdId: string,
  calendarIds: string[],
) {
  if (!calendarIds.length) {
    return;
  }

  const admin = createAdminClient();

  const { data: events } = await admin
    .from("calendar_events")
    .select("id, provenance")
    .eq("household_id", householdId);

  const removedIds = new Set<string>();

  for (const event of events ?? []) {
    const provenance = event.provenance as { source?: string; calendarId?: string; externalId?: string };
    if (provenance.source !== "google") {
      continue;
    }

    const calendarId = provenance.calendarId ?? "primary";
    const legacyMatch =
      !provenance.calendarId &&
      calendarIds.includes("primary") &&
      provenance.externalId &&
      !provenance.externalId.includes(":");

    if (calendarIds.includes(calendarId) || legacyMatch) {
      removedIds.add(event.id as string);
    }
  }

  if (!removedIds.size) {
    return;
  }

  const ids = [...removedIds];

  await admin
    .from("sync_mappings")
    .delete()
    .eq("household_id", householdId)
    .eq("entity_type", "calendar_event")
    .in("ntrr_id", ids);
  await admin.from("calendar_events").delete().in("id", ids);
}