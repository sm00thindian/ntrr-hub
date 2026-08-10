import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  agendaSortTimeMs,
  getZonedDayBounds,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
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
): Promise<AgendaItem[]> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const { start: rangeStart, end: rangeEnd } = getZonedDayBounds(zone);

  const [tasks, events] = await Promise.all([
    getHouseholdTasks(householdId),
    getCalendarEventsForRange(householdId, rangeStart, rangeEnd),
  ]);

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
    }));

  const eventItems: AgendaItem[] = events.map((event) => ({
    id: `event-${event.id}`,
    kind: "event" as const,
    title: event.title,
    sortAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: event.location,
    source: event.provenance.source,
    href: "/calendar",
  }));

  return [...taskItems, ...eventItems].sort(compareAgendaItems);
}
