"use server";

import { revalidatePath } from "next/cache";

import {
  type GoogleCalendarAssignment,
  defaultMemberColors,
  normalizeColor,
  CALENDAR_COLOR_PALETTE,
} from "@/lib/calendar/colors";
import {
  fetchGoogleCalendarList,
  getSelectedGoogleCalendarIds,
  removeSyncedEventsForCalendars,
} from "@/lib/integrations/google/calendars";
import { getConnectedGoogleIntegrationAdmin } from "@/lib/integrations/queries";
import {
  getHouseholdCalendarSettings,
  saveHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { memberDisplayLabel } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import { requireHouseholdContext } from "@/lib/households/context";
import { canManageIntegrations } from "@/lib/permissions/roles";
import { runAgentsForHousehold } from "@/lib/ai/orchestrator";
import { runHouseholdSync } from "@/lib/sync/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function disconnectGoogle() {
  const ctx = await requireHouseholdContext();

  if (!canManageIntegrations(ctx.role)) {
    return { error: "You do not have permission to manage integrations." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("integration_accounts")
    .update({
      status: "disconnected",
      metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq("household_id", ctx.householdId)
    .eq("provider", "google");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateGoogleCalendarSelection(calendarIds: string[]) {
  const ctx = await requireHouseholdContext();

  if (!canManageIntegrations(ctx.role)) {
    return { error: "You do not have permission to manage integrations." };
  }

  const account = await getConnectedGoogleIntegrationAdmin(ctx.householdId);
  if (!account) {
    return { error: "Connect Google before choosing calendars." };
  }

  const calendars = await fetchGoogleCalendarList(account);
  const primaryId = calendars.find((calendar) => calendar.primary)?.id ?? "primary";
  const validIds = [
    ...new Set(
      calendarIds
        .map((id) => (id === "primary" ? primaryId : id))
        .filter((id) => calendars.some((calendar) => calendar.id === id)),
    ),
  ];

  if (!validIds.length) {
    return { error: "Select at least one Google calendar to sync." };
  }

  const previous = getSelectedGoogleCalendarIds({
    ...account,
    metadata: {
      ...account.metadata,
      google: { ...account.metadata.google, calendars },
    },
  });
  // Also treat legacy "primary" selection as the real primary when computing removals
  const previousNormalized = [
    ...new Set(previous.map((id) => (id === "primary" ? primaryId : id))),
  ];
  const removed = previousNormalized.filter((id) => !validIds.includes(id));
  const googleState = account.metadata.google ?? {};
  const nextTokens = { ...(googleState.calendarSyncTokens ?? {}) };

  for (const calendarId of removed) {
    delete nextTokens[calendarId];
  }

  const admin = createAdminClient();
  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        google: {
          ...googleState,
          calendars,
          selectedCalendarIds: validIds,
          calendarSyncTokens: nextTokens,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  await removeSyncedEventsForCalendars(ctx.householdId, removed);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true };
}

type SaveGoogleCalendarSettingsInput = {
  selectedCalendarIds: string[];
  memberColors: Record<string, string>;
  calendarAssignments: Record<string, GoogleCalendarAssignment>;
};

export async function saveGoogleCalendarSettings(input: SaveGoogleCalendarSettingsInput) {
  const ctx = await requireHouseholdContext();

  if (!canManageIntegrations(ctx.role)) {
    return { error: "You do not have permission to manage integrations." };
  }

  const account = await getConnectedGoogleIntegrationAdmin(ctx.householdId);
  if (!account) {
    return { error: "Connect Google before choosing calendars." };
  }

  const calendars = await fetchGoogleCalendarList(account);
  const validIds = input.selectedCalendarIds.filter((id) =>
    calendars.some((calendar) => calendar.id === id),
  );

  if (!validIds.length) {
    return { error: "Select at least one Google calendar to sync." };
  }

  const members = await getHouseholdMembers(ctx.householdId);
  const colorMembers = members.map((member) => ({
    userId: member.userId,
    label: memberDisplayLabel(member.email, member.displayName),
  }));

  const memberColors = defaultMemberColors(colorMembers, input.memberColors);

  const calendarAssignments: Record<string, GoogleCalendarAssignment> = {};
  validIds.forEach((calendarId, index) => {
    const assignment = input.calendarAssignments[calendarId];
    const fallbackMemberId =
      colorMembers.find((member) => member.userId === assignment?.memberUserId)?.userId ??
      colorMembers[0]?.userId ??
      account.createdBy;

    calendarAssignments[calendarId] = {
      memberUserId: fallbackMemberId,
      color: normalizeColor(
        assignment?.color ?? CALENDAR_COLOR_PALETTE[index % CALENDAR_COLOR_PALETTE.length]!,
        CALENDAR_COLOR_PALETTE[0]!,
      ),
    };
  });

  const previous = getSelectedGoogleCalendarIds(account);
  const removed = previous.filter((id) => !validIds.includes(id));
  const googleState = account.metadata.google ?? {};
  const nextTokens = { ...(googleState.calendarSyncTokens ?? {}) };

  for (const calendarId of removed) {
    delete nextTokens[calendarId];
  }

  const admin = createAdminClient();
  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        google: {
          ...googleState,
          calendars,
          selectedCalendarIds: validIds,
          calendarSyncTokens: nextTokens,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  await removeSyncedEventsForCalendars(ctx.householdId, removed);

  const existing = await getHouseholdCalendarSettings(ctx.householdId);
  await saveHouseholdCalendarSettings(ctx.householdId, {
    ...existing,
    memberColors,
    googleCalendars: calendarAssignments,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true };
}

export async function syncGoogleNow() {
  const ctx = await requireHouseholdContext();

  if (!canManageIntegrations(ctx.role)) {
    return { error: "You do not have permission to sync integrations." };
  }

  const result = await runHouseholdSync(ctx.householdId);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/conflicts");

  try {
    await runAgentsForHousehold(ctx.householdId, "daily");
  } catch {
    // Non-blocking — /api/cron/digest remains the scheduled fallback.
  }

  const errors: string[] = [];
  if (!result.google.skipped && !result.google.success) {
    errors.push(result.google.error ?? "Google sync failed.");
  }
  if (!result.apple.skipped && !result.apple.success) {
    errors.push(result.apple.error ?? "Apple sync failed.");
  }

  if (result.google.skipped && result.apple.skipped) {
    return { error: "No integrations connected." };
  }

  if (errors.length) {
    return { error: errors.join(" ") };
  }

  return { success: true };
}