import Link from "next/link";

import { CalendarEntryColors } from "@/components/calendar/calendar-entry-colors";
import type { CalendarColorContext } from "@/lib/calendar/colors";
import { resolveEventColors, resolveTaskColors } from "@/lib/calendar/resolve-entry-colors";
import type { ResolvedEntryColors } from "@/lib/calendar/colors";
import { getEntryDisplayTitle } from "@/lib/calendar/entries";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";
import { calendarDateKeyInZone } from "@/lib/datetime/timezone";
import { eventOccursOnDay, isSameDay, toDayParam } from "@/lib/calendar/week";
import { cn } from "@/lib/utils";

type MonthCalendarProps = {
  days: string[];
  events: CalendarEvent[];
  tasks: CalendarTask[];
  month: number;
  year: number;
  colorContext: CalendarColorContext;
  timeZone: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_ITEMS = 3;

function taskOccursOnDay(dueAt: string, day: Date, timeZone: string): boolean {
  const wall = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return calendarDateKeyInZone(dueAt, timeZone) === wall;
}

type DayItem = {
  id: string;
  label: string;
  colors: ResolvedEntryColors;
};

export function MonthCalendar({
  days,
  events,
  tasks,
  month,
  year,
  colorContext,
  timeZone,
}: MonthCalendarProps) {
  const today = new Date();

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="min-w-[22rem] sm:min-w-0">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-muted-foreground px-0.5 py-1.5 text-center text-[10px] font-medium sm:px-2 sm:py-2 sm:text-xs"
          >
            <span className="sm:hidden">{label.slice(0, 1)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((dayIso) => {
          const day = new Date(`${dayIso}T00:00:00`);
          const inMonth = day.getMonth() === month && day.getFullYear() === year;
          const isToday = isSameDay(day, today);

          const dayTasks = tasks.filter((task) => taskOccursOnDay(task.dueAt, day, timeZone));
          const dayEvents = events.filter((event) =>
            eventOccursOnDay(event.startsAt, event.endsAt, day, event.allDay, timeZone),
          );

          const items: DayItem[] = [
            ...dayTasks.map((task) => ({
              id: `task-${task.id}`,
              label: getEntryDisplayTitle({ kind: "task", sortAt: task.dueAt, task }),
              colors: resolveTaskColors(task, colorContext),
            })),
            ...dayEvents.map((event) => ({
              id: `event-${event.id}`,
              label: getEntryDisplayTitle({ kind: "event", sortAt: event.startsAt, event }),
              colors: resolveEventColors(event, colorContext),
            })),
          ];

          const visible = items.slice(0, MAX_VISIBLE_ITEMS);
          const overflow = items.length - visible.length;

          return (
            <Link
              key={dayIso}
              href={`/calendar?view=1&date=${toDayParam(day)}`}
              className={cn(
                "min-h-16 border-b border-r p-1 transition-colors hover:bg-muted/30 sm:min-h-28 sm:p-2",
                !inMonth && "bg-muted/20 text-muted-foreground",
                isToday && "bg-brand/5 ring-1 ring-inset ring-brand/25",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1 sm:mb-2">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:min-w-7 sm:text-sm",
                    isToday ? "bg-foreground text-background" : undefined,
                  )}
                >
                  {day.getDate()}
                </span>
                {items.length > 0 ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-1 text-[9px] font-medium tabular-nums sm:hidden">
                    {items.length}
                  </span>
                ) : null}
              </div>

              {/* Full item chips on tablet+; phone shows count only to save space */}
              <ul className="hidden space-y-1 sm:block">
                {visible.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-1 rounded-md bg-muted/50 px-1 py-0.5 text-[11px] font-medium"
                  >
                    <CalendarEntryColors colors={item.colors} className="h-3" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </li>
                ))}
                {overflow > 0 ? (
                  <li className="text-muted-foreground px-1.5 text-[11px]">+{overflow} more</li>
                ) : null}
              </ul>
            </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}