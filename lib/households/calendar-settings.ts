import {
  type CalendarColorContext,
  type CalendarColorMember,
  type HouseholdCalendarSettings,
  defaultCalendarAssignments,
  defaultMemberColors,
} from "@/lib/calendar/colors";
import {
  getGoogleCalendarSettings,
  getSelectedGoogleCalendarIds,
} from "@/lib/integrations/google/calendars";
import {
  getAllConnectedGoogleIntegrationsAdmin,
  getConnectedGoogleIntegrationAdminForUser,
} from "@/lib/integrations/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { memberDisplayLabel } from "./member-label";
import { getHouseholdMembers } from "./queries";

function memberLabel(email: string, displayName: string | null) {
  return memberDisplayLabel(email, displayName);
}

export async function getHouseholdCalendarSettings(
  householdId: string,
): Promise<HouseholdCalendarSettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("households")
    .select("calendar_settings")
    .eq("id", householdId)
    .maybeSingle();

  if (error || !data) {
    return {};
  }

  return (data.calendar_settings ?? {}) as HouseholdCalendarSettings;
}

export async function saveHouseholdCalendarSettings(
  householdId: string,
  settings: HouseholdCalendarSettings,
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("households")
    .update({
      calendar_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", householdId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function buildCalendarColorContext(
  householdId: string,
): Promise<CalendarColorContext> {
  const [members, settings, googleAccounts] = await Promise.all([
    getHouseholdMembers(householdId),
    getHouseholdCalendarSettings(householdId),
    getAllConnectedGoogleIntegrationsAdmin(householdId),
  ]);

  const colorMembers: CalendarColorMember[] = members.map((member) => ({
    userId: member.userId,
    label: memberLabel(member.email, member.displayName),
  }));

  const selectedCalendarIds = [
    ...new Set(googleAccounts.flatMap((account) => getSelectedGoogleCalendarIds(account))),
  ];

  const memberColors = defaultMemberColors(colorMembers, settings.memberColors);
  const defaultMemberUserId =
    googleAccounts[0]?.createdBy ?? colorMembers[0]?.userId ?? "";

  const googleCalendars = defaultCalendarAssignments(
    selectedCalendarIds,
    colorMembers,
    defaultMemberUserId,
    settings.googleCalendars,
  );

  const calendarNames: Record<string, string> = {};
  for (const googleAccount of googleAccounts) {
    for (const calendar of googleAccount.metadata.google?.calendars ?? []) {
      calendarNames[calendar.id] = calendar.summary;
    }
  }

  return {
    memberColors,
    googleCalendars,
    members: colorMembers,
    selectedCalendarIds,
    calendarNames,
  };
}

export async function getGoogleCalendarSettingsForUi(
  householdId: string,
  userId: string,
) {
  const googleSettings = await getGoogleCalendarSettings(householdId, userId);
  if (!googleSettings) {
    return null;
  }

  const [members, settings, account] = await Promise.all([
    getHouseholdMembers(householdId),
    getHouseholdCalendarSettings(householdId),
    getConnectedGoogleIntegrationAdminForUser(householdId, userId),
  ]);

  const colorMembers: CalendarColorMember[] = members.map((member) => ({
    userId: member.userId,
    label: memberLabel(member.email, member.displayName),
  }));

  const memberColors = defaultMemberColors(colorMembers, settings.memberColors);
  const calendarAssignments = defaultCalendarAssignments(
    googleSettings.selectedCalendarIds,
    colorMembers,
    account?.createdBy ?? googleSettings.connectedByUserId,
    settings.googleCalendars,
  );

  return {
    calendars: googleSettings.calendars,
    selectedCalendarIds: googleSettings.selectedCalendarIds,
    members: colorMembers,
    memberColors,
    calendarAssignments,
  };
}