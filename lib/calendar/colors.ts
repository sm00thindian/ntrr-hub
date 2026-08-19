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
  appleCalendars: Record<string, AppleCalendarAssignment>;
  members: CalendarColorMember[];
  /** Active Google calendar ids + `apple:{integrationId}` keys for coloring / legend */
  selectedCalendarIds: string[];
  calendarNames: Record<string, string>;
  /** Current viewer — personal calendars nest only under this member in the legend */
  viewerUserId: string;
};

export type LegendCalendar = {
  calendarId: string;
  name: string;
  color: string;
  visibility: CalendarVisibility;
};

export type LegendMemberEntry = {
  member: CalendarColorMember;
  color: string;
  calendars: LegendCalendar[];
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

/**
 * Resolve a household member's chip accent color.
 * Returns undefined when unassigned / unknown so chips stay neutral.
 */
export function resolveMemberChipColor(
  userId: string | null | undefined,
  memberColors: Record<string, string> | null | undefined,
): string | undefined {
  if (!userId || !memberColors) {
    return undefined;
  }
  const raw = memberColors[userId];
  if (!raw) {
    return undefined;
  }
  const normalized = normalizeColor(raw, "");
  return normalized || undefined;
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

export function resolveSourceAssignment(
  calendarId: string,
  context: Pick<CalendarColorContext, "googleCalendars" | "appleCalendars">,
): GoogleCalendarAssignment | AppleCalendarAssignment | undefined {
  if (calendarId.startsWith("apple:")) {
    return context.appleCalendars[calendarId];
  }
  return context.googleCalendars[calendarId];
}

export function memberCalendarCount(
  memberUserId: string,
  selectedCalendarIds: string[],
  context: Pick<CalendarColorContext, "googleCalendars" | "appleCalendars">,
) {
  return selectedCalendarIds.filter((calendarId) => {
    const assignment = resolveSourceAssignment(calendarId, context);
    return assignment?.memberUserId === memberUserId;
  }).length;
}

/**
 * Legend: every household member with their primary color (tasks + identity),
 * whether or not they have items this week.
 *
 * Nested under each person:
 * - household-shared calendars assigned to them
 * - the viewer's own personal calendars (only under the viewer)
 */
export function buildLegendEntries(context: CalendarColorContext): LegendMemberEntry[] {
  return context.members.map((member) => {
    const calendars: LegendCalendar[] = [];

    for (const calendarId of context.selectedCalendarIds) {
      const assignment = resolveSourceAssignment(calendarId, context);
      if (!assignment || assignment.memberUserId !== member.userId) {
        continue;
      }

      const visibility =
        assignment.visibility === "personal" ? ("personal" as const) : ("household" as const);

      // Other people's personal calendars stay off the legend (viewer can't see them)
      if (visibility === "personal" && member.userId !== context.viewerUserId) {
        continue;
      }

      calendars.push({
        calendarId,
        name: context.calendarNames[calendarId] ?? "Calendar",
        color: normalizeColor(assignment.color ?? UNASSIGNED_COLOR, UNASSIGNED_COLOR),
        visibility,
      });
    }

    return {
      member,
      color: normalizeColor(
        context.memberColors[member.userId] ?? UNASSIGNED_COLOR,
        UNASSIGNED_COLOR,
      ),
      calendars,
    };
  });
}