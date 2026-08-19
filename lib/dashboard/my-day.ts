import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";
import type { GoogleCalendarAssignment } from "@/lib/calendar/colors";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  rankTomorrowPreview,
  type TomorrowFocusItem,
} from "@/lib/dashboard/needs-attention";
import {
  agendaSortTimeMs,
  getZonedDayBounds,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import { filterEventsForViewer } from "@/lib/calendar/visibility";
import { getCalendarVisibilityContext } from "@/lib/households/calendar-settings";
import { getHouseholdTasks, oneOpenPerRecurringTemplate } from "@/lib/tasks/queries";
import type { Task } from "@/lib/tasks/types";
import { prefersMyDayView, type HouseholdPersona } from "@/lib/permissions/roles";

export type MyDayBoard = {
  today: AgendaItem[];
  /** One-off tasks due tomorrow assigned to this member */
  tomorrow: TomorrowFocusItem[];
  tomorrowOverflow: number;
};

/** True when this member should land on the simplified My day experience. */
export function isMyDayPersona(persona: HouseholdPersona): boolean {
  return prefersMyDayView(persona);
}

/**
 * @deprecated Prefer filterEventsForViewer (household vs personal visibility).
 * Kept for call sites that still use assignment-only checks.
 */
export function eventBelongsToMember(
  event: CalendarEvent,
  memberUserId: string,
  googleCalendars: Record<string, GoogleCalendarAssignment> | undefined,
): boolean {
  const calendarId = event.provenance.calendarId;
  if (!calendarId || !googleCalendars) {
    return false;
  }
  const assignment = googleCalendars[calendarId];
  return assignment?.memberUserId === memberUserId;
}

export function taskBelongsToMember(
  task: { assigneeId: string | null },
  memberUserId: string,
): boolean {
  return task.assigneeId === memberUserId;
}

export function filterTasksForMember(tasks: Task[], memberUserId: string): Task[] {
  return tasks.filter((task) => taskBelongsToMember(task, memberUserId));
}

export function filterEventsForMember(
  events: CalendarEvent[],
  memberUserId: string,
  googleCalendars: Record<string, GoogleCalendarAssignment> | undefined,
): CalendarEvent[] {
  return events.filter((event) => eventBelongsToMember(event, memberUserId, googleCalendars));
}

export function filterCalendarTasksForMember(
  tasks: CalendarTask[],
  memberUserId: string,
): CalendarTask[] {
  return tasks.filter((task) => taskBelongsToMember(task, memberUserId));
}

function inZonedDay(isoMs: number, rangeStart: string, rangeEnd: string) {
  return isoMs >= agendaSortTimeMs(rangeStart) && isoMs < agendaSortTimeMs(rangeEnd);
}

/**
 * Open tasks (today / overdue / undated) plus tasks completed today so self-advocates
 * still see a clear "Done" confirmation instead of the row vanishing.
 */
function isActiveMyDayTask(task: Task, rangeStart: string, rangeEnd: string, nowMs: number) {
  if (task.status === "cancelled") {
    return false;
  }

  if (task.status === "done") {
    const updatedMs = Date.parse(task.updatedAt);
    if (Number.isFinite(updatedMs) && inZonedDay(updatedMs, rangeStart, rangeEnd)) {
      return true;
    }
    if (task.dueAt && inZonedDay(agendaSortTimeMs(task.dueAt), rangeStart, rangeEnd)) {
      return true;
    }
    return false;
  }

  if (!task.dueAt) {
    // Undated open tasks assigned to them still belong on My day
    return task.status === "todo" || task.status === "in_progress";
  }
  const dueMs = agendaSortTimeMs(task.dueAt);
  // Today or overdue
  return dueMs < agendaSortTimeMs(rangeEnd) || dueMs < nowMs;
}

function compareAgendaItems(a: AgendaItem, b: AgendaItem) {
  // Open work first; completed tasks sink to the bottom as proof of progress
  const aDone = a.kind === "task" && a.status === "done" ? 1 : 0;
  const bDone = b.kind === "task" && b.status === "done" ? 1 : 0;
  if (aDone !== bDone) {
    return aDone - bDone;
  }

  const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
  const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
  if (aAllDay !== bAllDay) {
    return aAllDay - bAllDay;
  }
  const startDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
  if (startDiff !== 0) {
    return startDiff;
  }
  return a.title.localeCompare(b.title);
}

/**
 * Self-advocate day board: their tasks (today + overdue + undated open),
 * calendar events from calendars assigned to them, plus a calm tomorrow look-ahead
 * of one-off (non-recurring) tasks only.
 */
export async function getMyDayAgenda(
  householdId: string,
  memberUserId: string,
  timeZone?: string,
): Promise<MyDayBoard> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const todayBounds = getZonedDayBounds(zone);
  const { start: rangeStart, end: rangeEnd } = todayBounds;
  // First instant of tomorrow in household zone
  const tomorrowBounds = getZonedDayBounds(zone, new Date(todayBounds.end));
  const nowMs = Date.now();

  const [tasks, events, visibility] = await Promise.all([
    getHouseholdTasks(householdId),
    getCalendarEventsForRange(householdId, rangeStart, rangeEnd),
    getCalendarVisibilityContext(householdId),
  ]);

  const mine = filterTasksForMember(oneOpenPerRecurringTemplate(tasks), memberUserId);
  // Shared household calendars + this member's personal calendars (ADR 0002)
  const myEvents = filterEventsForViewer(
    events,
    memberUserId,
    visibility.settings,
    visibility.options,
  );

  const taskItems: AgendaItem[] = mine
    .filter((task) => isActiveMyDayTask(task, rangeStart, rangeEnd, nowMs))
    .map((task) => {
      const overdue = Boolean(task.dueAt && agendaSortTimeMs(task.dueAt) < nowMs);
      return {
        id: `task-${task.id}`,
        kind: "task" as const,
        title: task.title,
        sortAt: task.dueAt ?? rangeStart,
        source: task.provenance.source,
        status: task.status,
        href: "/tasks",
        reliantConfirmRequested: task.reliantConfirmRequested,
        reliantSmsReminderRequested: task.reliantSmsReminderRequested,
        entityId: task.id,
        // Overdue undated-safe sort: overdue first via sortAt already past
        ...(overdue ? {} : {}),
      };
    });

  const eventItems: AgendaItem[] = myEvents.map((event) => ({
    id: `event-${event.id}`,
    kind: "event" as const,
    title: event.title,
    sortAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: event.location,
    source: event.provenance.source,
    href: "/calendar",
    reliantConfirmRequested: event.reliantConfirmRequested,
    entityId: event.id,
  }));

  const today = [...taskItems, ...eventItems].sort(compareAgendaItems);

  const { items: tomorrow, overflow: tomorrowOverflow } = rankTomorrowPreview({
    tasks: mine,
    rangeStart: tomorrowBounds.start,
    rangeEnd: tomorrowBounds.end,
    limit: 3,
  });

  return { today, tomorrow, tomorrowOverflow };
}

