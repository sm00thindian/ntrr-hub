export const MEMBER_COLOR_PALETTE = [
  "#00C853",
  "#1E88E5",
  "#FB8C00",
  "#8E24AA",
  "#E53935",
  "#6D4C41",
  "#546E7A",
] as const;

export const CALENDAR_COLOR_PALETTE = [
  "#69F0AE",
  "#82B1FF",
  "#FFD180",
  "#EA80FC",
  "#FF8A80",
  "#BCAAA4",
  "#B0BEC5",
] as const;

export const UNASSIGNED_COLOR = "#9CA3AF";

/** Who can see events from this source calendar */
export type CalendarVisibility = "household" | "personal";

export type GoogleCalendarAssignment = {
  memberUserId: string;
  color: string;
  /**
   * household = all members see events (default).
   * personal = only memberUserId sees events (owners do not break glass).
   */
  visibility?: CalendarVisibility;
};

/** Apple CalDAV assignments keyed by `apple:{integrationId}` */
export type AppleCalendarAssignment = {
  memberUserId: string;
  color: string;
  visibility?: CalendarVisibility;
};

export type HouseholdCalendarSettings = {
  memberColors?: Record<string, string>;
  googleCalendars?: Record<string, GoogleCalendarAssignment>;
  appleCalendars?: Record<string, AppleCalendarAssignment>;
  /** IANA timezone for displaying event times household-wide (e.g. America/Chicago) */
  timezone?: string;
};

export type CalendarColorMember = {
  userId: string;
  label: string;
};

export type CalendarColorContext = {
  memberColors: Record<string, string>;
  googleCalendars: Record<string, GoogleCalendarAssignment>;
  members: CalendarColorMember[];
  selectedCalendarIds: string[];
  calendarNames: Record<string, string>;
};

export type ResolvedEntryColors = {
  memberColor: string;
  calendarColor?: string;
  showCalendarAccent: boolean;
  memberLabel?: string;
};

export function normalizeColor(value: string, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export function defaultMemberColors(
  members: CalendarColorMember[],
  existing?: Record<string, string>,
) {
  const colors: Record<string, string> = { ...(existing ?? {}) };

  members.forEach((member, index) => {
    if (!colors[member.userId]) {
      colors[member.userId] = MEMBER_COLOR_PALETTE[index % MEMBER_COLOR_PALETTE.length]!;
    }
  });

  return colors;
}

export function defaultCalendarAssignments(
  calendarIds: string[],
  members: CalendarColorMember[],
  defaultMemberUserId: string,
  existing?: Record<string, GoogleCalendarAssignment>,
) {
  const assignments: Record<string, GoogleCalendarAssignment> = { ...(existing ?? {}) };
  const fallbackMemberId = members.some((member) => member.userId === defaultMemberUserId)
    ? defaultMemberUserId
    : members[0]?.userId;

  if (!fallbackMemberId) {
    return assignments;
  }

  calendarIds.forEach((calendarId, index) => {
    if (!assignments[calendarId]) {
      assignments[calendarId] = {
        memberUserId: fallbackMemberId,
        color: CALENDAR_COLOR_PALETTE[index % CALENDAR_COLOR_PALETTE.length]!,
        visibility: "household",
      };
    } else if (!assignments[calendarId]!.visibility) {
      // Existing rows default to shared household visibility
      assignments[calendarId] = {
        ...assignments[calendarId]!,
        visibility: "household",
      };
    }
  });

  return assignments;
}

export function memberCalendarCount(
  memberUserId: string,
  selectedCalendarIds: string[],
  assignments: Record<string, GoogleCalendarAssignment>,
) {
  return selectedCalendarIds.filter(
    (calendarId) => assignments[calendarId]?.memberUserId === memberUserId,
  ).length;
}

export function buildLegendEntries(context: CalendarColorContext) {
  return context.members
    .map((member) => ({
      member,
      color: normalizeColor(
        context.memberColors[member.userId] ?? UNASSIGNED_COLOR,
        UNASSIGNED_COLOR,
      ),
      calendars: context.selectedCalendarIds
        .filter((calendarId) => context.googleCalendars[calendarId]?.memberUserId === member.userId)
        .map((calendarId) => ({
          calendarId,
          name: context.calendarNames[calendarId] ?? "Calendar",
          color: normalizeColor(
            context.googleCalendars[calendarId]?.color ?? UNASSIGNED_COLOR,
            UNASSIGNED_COLOR,
          ),
        })),
    }))
    .filter((entry) => entry.calendars.length > 0);
}