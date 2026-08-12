import type {
  AppleCalendarAssignment,
  CalendarVisibility,
  GoogleCalendarAssignment,
  HouseholdCalendarSettings,
} from "@/lib/calendar/colors";
import type { Provenance } from "@/lib/provenance/types";

export function normalizeCalendarVisibility(
  value: CalendarVisibility | string | null | undefined,
): CalendarVisibility {
  return value === "personal" ? "personal" : "household";
}

export function appleCalendarKey(integrationId: string) {
  return `apple:${integrationId}`;
}

function resolveAssignment(
  calendarId: string | undefined,
  settings: HouseholdCalendarSettings,
): GoogleCalendarAssignment | AppleCalendarAssignment | null {
  if (!calendarId) {
    return null;
  }
  if (calendarId.startsWith("apple:")) {
    return settings.appleCalendars?.[calendarId] ?? null;
  }
  return settings.googleCalendars?.[calendarId] ?? null;
}

/**
 * Whether an event is visible to a household member.
 * - household visibility → everyone
 * - personal visibility → only assignment.memberUserId (no owner break-glass)
 * - missing assignment / calendarId → treat as household (legacy events stay visible)
 */
export function eventVisibleToUser(
  event: { provenance: Provenance },
  viewerUserId: string,
  settings: HouseholdCalendarSettings,
): boolean {
  const calendarId = event.provenance.calendarId;
  const assignment = resolveAssignment(calendarId, settings);

  if (!assignment) {
    return true;
  }

  const visibility = normalizeCalendarVisibility(assignment.visibility);
  if (visibility === "household") {
    return true;
  }

  return assignment.memberUserId === viewerUserId;
}

export function filterEventsForViewer<T extends { provenance: Provenance }>(
  events: T[],
  viewerUserId: string,
  settings: HouseholdCalendarSettings,
): T[] {
  return events.filter((event) => eventVisibleToUser(event, viewerUserId, settings));
}
