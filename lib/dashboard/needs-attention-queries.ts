import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import { filterEventsForViewer } from "@/lib/calendar/visibility";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  rankNeedsAttention,
  rankTomorrowPreview,
  type FocusBoard,
} from "@/lib/dashboard/needs-attention";
import { getZonedDayBounds, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { getHouseholdTasks, oneOpenPerRecurringTemplate } from "@/lib/tasks/queries";

export async function getNeedsAttention(
  householdId: string,
  timeZone?: string,
  limit = 6,
  viewerUserId?: string,
  tomorrowLimit = 3,
): Promise<FocusBoard> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const todayBounds = getZonedDayBounds(zone);
  // todayBounds.end is the first instant of tomorrow in the household zone
  const tomorrowBounds = getZonedDayBounds(zone, new Date(todayBounds.end));

  const [tasks, todayEvents, tomorrowEvents, conflictCount, calendarSettings] =
    await Promise.all([
      getHouseholdTasks(householdId),
      getCalendarEventsForRange(householdId, todayBounds.start, todayBounds.end),
      getCalendarEventsForRange(householdId, tomorrowBounds.start, tomorrowBounds.end),
      getPendingConflictCount(householdId),
      getHouseholdCalendarSettings(householdId),
    ]);

  const toAgenda = (
    events: Awaited<ReturnType<typeof getCalendarEventsForRange>>,
  ): AgendaItem[] => {
    const visible = viewerUserId
      ? filterEventsForViewer(events, viewerUserId, calendarSettings)
      : events;
    return visible.map((event) => ({
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
  };

  // Never show three "brush teeth" overdue rows for one series
  const uniqueTasks = oneOpenPerRecurringTemplate(tasks);

  const today = rankNeedsAttention({
    tasks: uniqueTasks,
    events: toAgenda(todayEvents),
    conflictCount,
    rangeStart: todayBounds.start,
    limit,
  });

  const { items: tomorrow, overflow: tomorrowOverflow } = rankTomorrowPreview({
    tasks: uniqueTasks,
    events: toAgenda(tomorrowEvents),
    rangeStart: tomorrowBounds.start,
    rangeEnd: tomorrowBounds.end,
    limit: tomorrowLimit,
  });

  return { today, tomorrow, tomorrowOverflow };
}
