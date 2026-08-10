import { getCalendarEventsForRange } from "@/lib/calendar/queries";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  rankNeedsAttention,
  type NeedsAttentionItem,
} from "@/lib/dashboard/needs-attention";
import { getZonedDayBounds, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { getHouseholdTasks } from "@/lib/tasks/queries";

export async function getNeedsAttention(
  householdId: string,
  timeZone?: string,
  limit = 6,
): Promise<NeedsAttentionItem[]> {
  const zone = resolveHouseholdTimeZone(timeZone);
  const { start: rangeStart, end: rangeEnd } = getZonedDayBounds(zone);

  const [tasks, events, conflictCount] = await Promise.all([
    getHouseholdTasks(householdId),
    getCalendarEventsForRange(householdId, rangeStart, rangeEnd),
    getPendingConflictCount(householdId),
  ]);

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
    reliantConfirmRequested: event.reliantConfirmRequested,
    entityId: event.id,
  }));

  return rankNeedsAttention({
    tasks,
    events: eventItems,
    conflictCount,
    rangeStart,
    limit,
  });
}
