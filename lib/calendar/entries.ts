import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";
import {
  calendarDateKeyInZone,
  formatClockCompactInZone,
  formatDateInZone,
  formatTimeInZone,
  isMidnightInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { eventOccursOnDay } from "@/lib/calendar/week";

export type CalendarEntry =
  | { kind: "event"; sortAt: string; event: CalendarEvent }
  | { kind: "task"; sortAt: string; task: CalendarTask };

export function getEntriesForDay(
  day: Date,
  events: CalendarEvent[],
  tasks: CalendarTask[],
  timeZone?: string,
): CalendarEntry[] {
  const zone = resolveHouseholdTimeZone(timeZone);
  const dayEvents = events
    .filter((event) => eventOccursOnDay(event.startsAt, event.endsAt, day, event.allDay, zone))
    .map((event) => ({ kind: "event" as const, sortAt: event.startsAt, event }));

  const dayTasks = tasks
    .filter((task) => taskOccursOnDay(task.dueAt, day, zone))
    .map((task) => ({ kind: "task" as const, sortAt: task.dueAt, task }));

  return [...dayEvents, ...dayTasks].sort(
    (left, right) => new Date(left.sortAt).getTime() - new Date(right.sortAt).getTime(),
  );
}

function taskOccursOnDay(dueAt: string, day: Date, timeZone: string): boolean {
  const wall = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return calendarDateKeyInZone(dueAt, timeZone) === wall;
}

export function formatEntryTime(entry: CalendarEntry, timeZone?: string) {
  const zone = resolveHouseholdTimeZone(timeZone);

  if (entry.kind === "event") {
    if (entry.event.allDay) {
      return "All day";
    }

    const start = formatTimeInZone(entry.event.startsAt, zone);
    const end = formatTimeInZone(entry.event.endsAt, zone);
    return `${start} – ${end}`;
  }

  if (isMidnightInZone(entry.task.dueAt, zone)) {
    return "Due today";
  }

  return `Due ${formatTimeInZone(entry.task.dueAt, zone)}`;
}

export function formatEntryTimeCompact(entry: CalendarEntry, timeZone?: string) {
  const zone = resolveHouseholdTimeZone(timeZone);

  if (entry.kind === "event") {
    if (entry.event.allDay) {
      return "All day";
    }

    const start = formatClockCompactInZone(entry.event.startsAt, zone);
    const end = formatClockCompactInZone(entry.event.endsAt, zone);
    return start === end ? start : `${start}–${end}`;
  }

  if (isMidnightInZone(entry.task.dueAt, zone)) {
    return "Due today";
  }

  return `Due ${formatClockCompactInZone(entry.task.dueAt, zone)}`;
}

export function formatEntryDate(entry: CalendarEntry, timeZone?: string) {
  const iso = entry.kind === "event" ? entry.event.startsAt : entry.task.dueAt;
  return formatDateInZone(iso, resolveHouseholdTimeZone(timeZone));
}

export function getEntryTitle(entry: CalendarEntry) {
  return entry.kind === "event" ? entry.event.title : entry.task.title;
}

export function getEntryDisplayTitle(entry: CalendarEntry) {
  const title = getEntryTitle(entry).trim();
  if (title && title !== "Untitled event" && title !== "Untitled task") {
    return title;
  }

  return entry.kind === "task" ? "Task" : "Event";
}

export function getEntryKey(entry: CalendarEntry) {
  return entry.kind === "event" ? `event-${entry.event.id}` : `task-${entry.task.id}`;
}