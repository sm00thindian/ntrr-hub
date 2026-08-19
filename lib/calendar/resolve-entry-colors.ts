import type { CalendarEntry } from "@/lib/calendar/entries";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";

import {
  type CalendarColorContext,
  type ResolvedEntryColors,
  UNASSIGNED_COLOR,
  memberCalendarCount,
  normalizeColor,
  resolveSourceAssignment,
} from "./colors";

export function resolveEventColors(
  event: CalendarEvent,
  context: CalendarColorContext,
): ResolvedEntryColors {
  const calendarId = event.provenance.calendarId ?? "primary";
  const assignment = resolveSourceAssignment(calendarId, context);
  const memberUserId = assignment?.memberUserId;
  const member = context.members.find((entry) => entry.userId === memberUserId);
  const memberColor = memberUserId
    ? normalizeColor(
        context.memberColors[memberUserId] ?? UNASSIGNED_COLOR,
        UNASSIGNED_COLOR,
      )
    : UNASSIGNED_COLOR;

  const showCalendarAccent = memberUserId
    ? memberCalendarCount(memberUserId, context.selectedCalendarIds, context) > 1
    : false;

  return {
    memberColor,
    calendarColor: assignment
      ? normalizeColor(assignment.color, memberColor)
      : undefined,
    showCalendarAccent,
    memberLabel: member?.label,
  };
}

export function resolveTaskColors(
  task: CalendarTask,
  context: CalendarColorContext,
): ResolvedEntryColors {
  const memberUserId = task.assigneeId;
  const member = context.members.find((entry) => entry.userId === memberUserId);

  if (!memberUserId) {
    return {
      memberColor: UNASSIGNED_COLOR,
      showCalendarAccent: false,
    };
  }

  return {
    memberColor: normalizeColor(
      context.memberColors[memberUserId] ?? UNASSIGNED_COLOR,
      UNASSIGNED_COLOR,
    ),
    showCalendarAccent: false,
    memberLabel: member?.label,
  };
}

export function resolveEntryColors(
  entry: CalendarEntry,
  context: CalendarColorContext,
): ResolvedEntryColors {
  return entry.kind === "event"
    ? resolveEventColors(entry.event, context)
    : resolveTaskColors(entry.task, context);
}