import type {
  AppleCalendarAssignment,
  CalendarVisibility,
  GoogleCalendarAssignment,
  HouseholdCalendarSettings,
} from "@/lib/calendar/colors";
import type { Provenance } from "@/lib/provenance/types";

export type CalendarAssignment = GoogleCalendarAssignment | AppleCalendarAssignment;

/**
 * Optional Google primary aliases for a household: real calendar list ids that
 * correspond to each connected account's primary calendar.
 * Used so personal settings keyed by email still match events stored as "primary"
 * (and the reverse).
 */
export type CalendarVisibilityOptions = {
  /** Real Google primary calendar ids for connected accounts (not the "primary" alias). */
  googlePrimaryIds?: string[];
};

export function normalizeCalendarVisibility(
  value: CalendarVisibility | string | null | undefined,
): CalendarVisibility {
  return value === "personal" ? "personal" : "household";
}

export function appleCalendarKey(integrationId: string) {
  return `apple:${integrationId}`;
}

/**
 * Collapse Google's "primary" alias onto real calendar ids in assignment maps.
 * Call when loading or saving settings so personal flags apply under the same
 * keys events use after sync.
 */
export function normalizeGoogleCalendarAssignments(
  assignments: Record<string, GoogleCalendarAssignment> | undefined,
  primaryIds: string[],
): Record<string, GoogleCalendarAssignment> {
  const next: Record<string, GoogleCalendarAssignment> = { ...(assignments ?? {}) };
  const realPrimaries = primaryIds.filter((id) => id && id !== "primary");

  const primaryAssignment = next.primary;
  if (primaryAssignment) {
    for (const realId of realPrimaries) {
      // Prefer an explicit real-id row; otherwise copy personal/household from "primary"
      if (!next[realId]) {
        next[realId] = { ...primaryAssignment };
      } else if (
        normalizeCalendarVisibility(next[realId]!.visibility) === "household" &&
        normalizeCalendarVisibility(primaryAssignment.visibility) === "personal"
      ) {
        // Personal under "primary" must win over a default household row on the real id
        next[realId] = {
          ...next[realId]!,
          ...primaryAssignment,
          memberUserId: primaryAssignment.memberUserId || next[realId]!.memberUserId,
          visibility: "personal",
        };
      }
    }
    // Drop ambiguous alias once mirrored (multi-account safe: each real id has its own row)
    if (realPrimaries.length > 0) {
      delete next.primary;
    }
  }

  return next;
}

/**
 * Resolve household vs personal assignment for a source calendar id.
 * Handles Google primary ↔ real-id aliasing when `googlePrimaryIds` is provided.
 */
export function resolveCalendarAssignment(
  calendarId: string | undefined,
  settings: HouseholdCalendarSettings,
  options?: CalendarVisibilityOptions,
): CalendarAssignment | null {
  if (!calendarId) {
    return null;
  }

  if (calendarId.startsWith("apple:")) {
    return settings.appleCalendars?.[calendarId] ?? null;
  }

  const map = settings.googleCalendars ?? {};
  const direct = map[calendarId];
  if (direct) {
    return direct;
  }

  const primaryIds = (options?.googlePrimaryIds ?? []).filter((id) => id && id !== "primary");

  // Event still labeled "primary" — try each known real primary id
  if (calendarId === "primary") {
    for (const realId of primaryIds) {
      if (map[realId]) {
        return map[realId]!;
      }
    }
    return map.primary ?? null;
  }

  // Event uses real primary id; settings only stored under "primary"
  if (primaryIds.includes(calendarId) && map.primary) {
    return map.primary;
  }

  return null;
}

/** @deprecated Use resolveCalendarAssignment */
function resolveAssignment(
  calendarId: string | undefined,
  settings: HouseholdCalendarSettings,
  options?: CalendarVisibilityOptions,
): CalendarAssignment | null {
  return resolveCalendarAssignment(calendarId, settings, options);
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
  options?: CalendarVisibilityOptions,
): boolean {
  const calendarId = event.provenance.calendarId;
  const assignment = resolveAssignment(calendarId, settings, options);

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
  options?: CalendarVisibilityOptions,
): T[] {
  return events.filter((event) => eventVisibleToUser(event, viewerUserId, settings, options));
}

/**
 * Family board rule: only shared (household) calendars.
 * Personal calendars are never included — even for the calendar owner.
 * Missing assignment / calendarId → household (legacy).
 */
export function eventIsHouseholdShared(
  event: { provenance: Provenance },
  settings: HouseholdCalendarSettings,
  options?: CalendarVisibilityOptions,
): boolean {
  const calendarId = event.provenance.calendarId;
  const assignment = resolveAssignment(calendarId, settings, options);

  if (!assignment) {
    return true;
  }

  return normalizeCalendarVisibility(assignment.visibility) === "household";
}

/** Events for caregiver Focus — household/shared calendars only. */
export function filterHouseholdCalendarEvents<T extends { provenance: Provenance }>(
  events: T[],
  settings: HouseholdCalendarSettings,
  options?: CalendarVisibilityOptions,
): T[] {
  return events.filter((event) => eventIsHouseholdShared(event, settings, options));
}
