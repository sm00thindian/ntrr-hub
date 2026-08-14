import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import { filterHouseholdCalendarEvents } from "@/lib/calendar/visibility";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  buildCaregiverFocusToday,
  rankTomorrowPreview,
  type FocusBoard,
} from "@/lib/dashboard/needs-attention";
import { getZonedDayBounds, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { getHouseholdTasks, oneOpenPerRecurringTemplate } from "@/lib/tasks/queries";

/**
 * Caregiver Focus board: household day timeline + one-off tomorrow.
 * Calendar events: household/shared visibility only (never personal).
 */
export async function getNeedsAttention(
  householdId: string,
  timeZone?: string,
  _limit = 6,
  _viewerUserId?: string,
  tomorrowLimit = 3,
): Promise<FocusBoard> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const todayBounds = getZonedDayBounds(zone);
  const tomorrowBounds = getZonedDayBounds(zone, new Date(todayBounds.end));

  const [tasks, todayEvents, conflictCount, calendarSettings] = await Promise.all([
    getHouseholdTasks(householdId),
    getCalendarEventsForRange(householdId, todayBounds.start, todayBounds.end),
    getPendingConflictCount(householdId),
    getHouseholdCalendarSettings(householdId),
  ]);

  // Family board: shared calendars only — not personal, even for the owner
  const householdEvents = filterHouseholdCalendarEvents(todayEvents, calendarSettings);

  const eventItems: AgendaItem[] = householdEvents.map((event) => ({
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

  const uniqueTasks = oneOpenPerRecurringTemplate(tasks);

  const today = buildCaregiverFocusToday({
    tasks: uniqueTasks,
    events: eventItems,
    conflictCount,
    rangeStart: todayBounds.start,
    rangeEnd: todayBounds.end,
  });

  const { items: tomorrow, overflow: tomorrowOverflow } = rankTomorrowPreview({
    tasks: uniqueTasks,
    rangeStart: tomorrowBounds.start,
    rangeEnd: tomorrowBounds.end,
    limit: tomorrowLimit,
  });

  return { today, tomorrow, tomorrowOverflow };
}
