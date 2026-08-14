"use server";

import { revalidatePath } from "next/cache";

import {
  type CalendarVisibility,
  type GoogleCalendarAssignment,
  defaultMemberColors,
  normalizeColor,
  CALENDAR_COLOR_PALETTE,
} from "@/lib/calendar/colors";
import { normalizeCalendarVisibility } from "@/lib/calendar/visibility";
import {
  fetchGoogleCalendarList,
  getGoogleCalendarsAlreadyInHousehold,
  getSelectedGoogleCalendarIds,
  removeSyncedEventsForCalendars,
} from "@/lib/integrations/google/calendars";
import {
  getConnectedGoogleIntegrationAdminForUser,
} from "@/lib/integrations/queries";
import {
  getHouseholdCalendarSettings,
  saveHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { memberDisplayLabel } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import { requireHouseholdContext } from "@/lib/households/context";
import { canConnectCalendars, canManageIntegrations } from "@/lib/permissions/roles";
import { runAgentsForHousehold } from "@/lib/ai/orchestrator";
import { runHouseholdSync } from "@/lib/sync/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function assertCanConnect(ctx: Awaited<ReturnType<typeof requireHouseholdContext>>) {
  if (!canConnectCalendars(ctx.role, ctx.persona)) {
    return { error: "You do not have permission to manage calendar connections." };
  }
  return null;
}

/** Disconnect this member's Google connection only. */
export async function disconnectGoogle() {
  const ctx = await requireHouseholdContext();
  const denied = assertCanConnect(ctx);
  if (denied) {
    return denied;
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
    .eq("provider", "google")
    .eq("created_by", ctx.userId);

  if (error) {
    return { error: error.message };
  }

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
  const denied = assertCanConnect(ctx);
  if (denied) {
    return denied;
  }

  const account = await getConnectedGoogleIntegrationAdminForUser(
    ctx.householdId,
    ctx.userId,
  );
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

  // Block re-adding a shared Family calendar already synced by someone else
  const alreadyInHousehold = await getGoogleCalendarsAlreadyInHousehold(
    ctx.householdId,
    ctx.userId,
  );
  const duplicates = validIds.filter((id) => alreadyInHousehold[id]);
  if (duplicates.length) {
    const labels = duplicates
      .map((id) => {
        const entry = alreadyInHousehold[id]!;
        const name = calendars.find((c) => c.id === id)?.summary ?? id;
        return `"${name}" (already via ${entry.connectedByLabel})`;
      })
      .join("; ");
    return {
      error: `These calendars are already connected for the household: ${labels}. Leave them unchecked — Hub will keep using the existing connection.`,
    };
  }

  const members = await getHouseholdMembers(ctx.householdId);
  const colorMembers = members.map((member) => ({
    userId: member.userId,
    label: memberDisplayLabel(member.email, member.displayName),
  }));

  // Only owners/admins edit household-wide member color palette
  const existingSettings = await getHouseholdCalendarSettings(ctx.householdId);
  const memberColors = canManageIntegrations(ctx.role)
    ? defaultMemberColors(colorMembers, input.memberColors)
    : defaultMemberColors(colorMembers, existingSettings.memberColors);

  const calendarAssignments: Record<string, GoogleCalendarAssignment> = {
    ...(existingSettings.googleCalendars ?? {}),
  };

  validIds.forEach((calendarId, index) => {
    const assignment = input.calendarAssignments[calendarId];
    const fallbackMemberId =
      colorMembers.find((member) => member.userId === assignment?.memberUserId)?.userId ??
      ctx.userId;

    calendarAssignments[calendarId] = {
      memberUserId: fallbackMemberId,
      color: normalizeColor(
        assignment?.color ?? CALENDAR_COLOR_PALETTE[index % CALENDAR_COLOR_PALETTE.length]!,
        CALENDAR_COLOR_PALETTE[0]!,
      ),
      visibility: normalizeCalendarVisibility(assignment?.visibility),
    };
  });

  // Drop assignments for calendars this user unselected (only their previous selection)
  const previous = getSelectedGoogleCalendarIds(account);
  const removed = previous.filter((id) => !validIds.includes(id));
  for (const calendarId of removed) {
    delete calendarAssignments[calendarId];
  }

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

  await saveHouseholdCalendarSettings(ctx.householdId, {
    ...existingSettings,
    memberColors,
    googleCalendars: calendarAssignments,
  });

  // Pull events for newly selected calendars immediately (full pull)
  try {
    await runHouseholdSync(ctx.householdId, { forceFullCalendarPull: true });
  } catch {
    // Settings already saved; user can Sync now if pull fails
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  return { success: true };
}

export async function saveAppleCalendarVisibility(formData: FormData) {
  const ctx = await requireHouseholdContext();
  const denied = assertCanConnect(ctx);
  if (denied) {
    return denied;
  }

  const visibility = normalizeCalendarVisibility(
    String(formData.get("visibility") ?? "household"),
  ) as CalendarVisibility;
  const memberUserId = String(formData.get("memberUserId") ?? ctx.userId).trim() || ctx.userId;

  const { getMemberIntegration } = await import("@/lib/integrations/queries");
  const apple = await getMemberIntegration(ctx.householdId, "apple_caldav", ctx.userId);
  if (!apple || apple.status !== "connected") {
    return { error: "Connect Apple before saving calendar sharing." };
  }

  const key = `apple:${apple.id}`;
  const existing = await getHouseholdCalendarSettings(ctx.householdId);
  const appleCalendars = { ...(existing.appleCalendars ?? {}) };
  appleCalendars[key] = {
    memberUserId,
    color: appleCalendars[key]?.color ?? CALENDAR_COLOR_PALETTE[0]!,
    visibility,
  };

  await saveHouseholdCalendarSettings(ctx.householdId, {
    ...existing,
    appleCalendars,
  });

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function syncGoogleNow() {
  const ctx = await requireHouseholdContext();
  const denied = assertCanConnect(ctx);
  if (denied) {
    return denied;
  }

  // Manual Sync now: full calendar pull so new family-calendar events are not missed
  // by a stale incremental token.
  const result = await runHouseholdSync(ctx.householdId, {
    forceFullCalendarPull: true,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/conflicts");

  try {
    await runAgentsForHousehold(ctx.householdId, "daily");
  } catch {
    // Non-blocking
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
