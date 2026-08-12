import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import { filterEventsForViewer } from "@/lib/calendar/visibility";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  agendaSortTimeMs,
  getZonedDayBounds,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getHouseholdTasks } from "@/lib/tasks/queries";

function isTaskActiveToday(
  dueAt: string | null,
  status: string,
  rangeStart: string,
  rangeEnd: string,
) {
  if (status === "done" || status === "cancelled") {
    return false;
  }

  if (!dueAt) {
    return status === "todo" || status === "in_progress";
  }

  const dueMs = agendaSortTimeMs(dueAt);
  const startMs = agendaSortTimeMs(rangeStart);
  const endMs = agendaSortTimeMs(rangeEnd);
  return dueMs >= startMs && dueMs < endMs;
}

function compareAgendaItems(a: AgendaItem, b: AgendaItem) {
  // All-day events first, then timed by start ascending
  const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
  const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
  if (aAllDay !== bAllDay) {
    return aAllDay - bAllDay;
  }

  const startDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
  if (startDiff !== 0) {
    return startDiff;
  }

  const endDiff = agendaSortTimeMs(a.endsAt) - agendaSortTimeMs(b.endsAt);
  if (endDiff !== 0) {
    return endDiff;
  }

  return a.title.localeCompare(b.title);
}

export async function getTodayAgenda(
  householdId: string,
  timeZone?: string,
  viewerUserId?: string,
): Promise<AgendaItem[]> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const { start: rangeStart, end: rangeEnd } = getZonedDayBounds(zone);

  const [tasks, events, calendarSettings] = await Promise.all([
    getHouseholdTasks(householdId),
    getCalendarEventsForRange(householdId, rangeStart, rangeEnd),
    getHouseholdCalendarSettings(householdId),
  ]);

  const visibleEvents = viewerUserId
    ? filterEventsForViewer(events, viewerUserId, calendarSettings)
    : events;

  const taskItems: AgendaItem[] = tasks
    .filter((task) => isTaskActiveToday(task.dueAt, task.status, rangeStart, rangeEnd))
    .map((task) => ({
      id: `task-${task.id}`,
      kind: "task" as const,
      title: task.title,
      sortAt: task.dueAt ?? rangeStart,
      source: task.provenance.source,
      status: task.status,
      href: "/tasks",
      reliantConfirmRequested: task.reliantConfirmRequested,
      entityId: task.id,
      assigneeLabel: task.assigneeLabel,
      assigneePersona: task.assigneePersona,
    }));

  const eventItems: AgendaItem[] = visibleEvents.map((event) => ({
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

  return [...taskItems, ...eventItems].sort(compareAgendaItems);
}
