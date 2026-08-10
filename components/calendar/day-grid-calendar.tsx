"use client";

import { useState } from "react";
import { ListTodo } from "lucide-react";

import { CalendarEntryColors } from "@/components/calendar/calendar-entry-colors";
import { CalendarEntryDetail } from "@/components/calendar/calendar-entry-detail";
import type { CalendarColorContext } from "@/lib/calendar/colors";
import { resolveEntryColors } from "@/lib/calendar/resolve-entry-colors";
import type { CalendarEntry } from "@/lib/calendar/entries";
import {
  formatEntryTimeCompact,
  getEntriesForDay,
  getEntryDisplayTitle,
  getEntryKey,
} from "@/lib/calendar/entries";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/types";
import { isSameDay } from "@/lib/calendar/week";
import { cn } from "@/lib/utils";

type DayGridView = "5" | "7";

type DayGridCalendarProps = {
  view: DayGridView;
  days: string[];
  events: CalendarEvent[];
  tasks: CalendarTask[];
  colorContext: CalendarColorContext;
  timeZone: string;
};

export function DayGridCalendar({
  view,
  days,
  events,
  tasks,
  colorContext,
  timeZone,
}: DayGridCalendarProps) {
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const today = new Date();

  return (
    <>
      <div
        className={cn(
          view === "7" && "overflow-x-auto pb-1",
          view === "5"
            ? "grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            : "grid min-w-[64rem] grid-cols-7 gap-3",
        )}
      >
        {days.map((dayIso) => {
          const day = new Date(`${dayIso}T00:00:00`);
          const entries = getEntriesForDay(day, events, tasks, timeZone);
          const isToday = isSameDay(day, today);

          return (
            <section
              key={dayIso}
              className={cn(
                "flex min-h-52 flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
                isToday && "border-brand/40 ring-1 ring-brand/20",
              )}
            >
              <header
                className={cn(
                  "flex items-center justify-between gap-2 border-b px-3 py-2.5",
                  isToday ? "bg-brand/5" : "bg-muted/30",
                )}
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground truncate text-[10px] font-semibold uppercase tracking-wide">
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-sm font-semibold">
                    {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isToday ? (
                    <span className="bg-brand text-brand-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Today
                    </span>
                  ) : null}
                  {entries.length ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
                      {entries.length}
                    </span>
                  ) : null}
                </div>
              </header>

              <div className="flex-1 px-1.5 py-1.5">
                {entries.length ? (
                  <ul className="space-y-0.5">
                    {entries.map((entry) => {
                      const colors = resolveEntryColors(entry, colorContext);
                      const title = getEntryDisplayTitle(entry);
                      const time = formatEntryTimeCompact(entry, timeZone);
                      const isTask = entry.kind === "task";

                      return (
                        <li key={getEntryKey(entry)}>
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            aria-label={`${title}, ${time}${colors.memberLabel ? `, ${colors.memberLabel}` : ""}`}
                            className="hover:bg-muted/60 focus-visible:ring-ring group flex w-full items-stretch gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                          >
                            <CalendarEntryColors colors={colors} className="min-h-[2.25rem]" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-1">
                                {isTask ? (
                                  <ListTodo
                                    className="text-brand mt-0.5 h-3 w-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <span className="line-clamp-2 text-sm font-medium leading-snug">
                                  {title}
                                </span>
                              </span>
                              <span className="text-muted-foreground mt-0.5 block text-[11px] leading-tight">
                                {time}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground px-2 py-8 text-center text-xs">
                    Nothing scheduled
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <CalendarEntryDetail
        entry={selectedEntry}
        colorContext={colorContext}
        timeZone={timeZone}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  );
}