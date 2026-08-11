"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { rememberCalendarView } from "@/components/calendar/calendar-default-view";
import { Button } from "@/components/ui/button";
import type { CalendarView } from "@/lib/calendar/views";
import { cn } from "@/lib/utils";

type CalendarViewNavProps = {
  view: CalendarView;
  periodLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  viewHrefs: Record<CalendarView, string>;
};

const viewOptions: { value: CalendarView; label: string; short: string }[] = [
  { value: "1", label: "Day", short: "Day" },
  { value: "5", label: "5 day", short: "5d" },
  { value: "7", label: "Week", short: "7d" },
  { value: "month", label: "Month", short: "Mo" },
];

export function CalendarViewNav({
  view,
  periodLabel,
  prevHref,
  nextHref,
  todayHref,
  viewHrefs,
}: CalendarViewNavProps) {
  const prevLabel =
    view === "month"
      ? "Previous month"
      : view === "1"
        ? "Previous day"
        : view === "5"
          ? "Previous work week"
          : "Previous week";
  const nextLabel =
    view === "month"
      ? "Next month"
      : view === "1"
        ? "Next day"
        : view === "5"
          ? "Next work week"
          : "Next week";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Calendar</h1>
          <p className="text-muted-foreground mt-0.5 text-sm sm:text-base">{periodLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button asChild variant="outline" size="icon" className="h-10 w-10" aria-label={prevLabel}>
            <Link href={prevHref}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-10 px-3">
            <Link href={todayHref}>Today</Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="h-10 w-10" aria-label={nextLabel}>
            <Link href={nextHref}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div
        className="bg-muted flex w-full rounded-xl p-1"
        role="tablist"
        aria-label="Calendar view"
      >
        {viewOptions.map((option) => (
          <Link
            key={option.value}
            href={viewHrefs[option.value]}
            role="tab"
            aria-selected={view === option.value}
            onClick={() => rememberCalendarView(option.value)}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-lg px-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              view === option.value
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
