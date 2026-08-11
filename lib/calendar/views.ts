import {
  addDays,
  formatWeekRange,
  startOfWeek,
  toDayParam,
} from "@/lib/calendar/week";

export type CalendarView = "1" | "5" | "7" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseCalendarView(value?: string): CalendarView | null {
  if (value === "1" || value === "5" || value === "7" || value === "month") {
    return value;
  }
  return null;
}

export function parseCalendarDate(date?: string, legacyWeek?: string): Date {
  const raw = date ?? legacyWeek;
  if (!raw) {
    return new Date();
  }

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

export type CalendarBounds = {
  view: CalendarView;
  anchor: Date;
  days: Date[];
  rangeStart: string;
  rangeEnd: string;
  periodLabel: string;
  dateParam: string;
};

export function getCalendarBounds(view: CalendarView, anchor: Date): CalendarBounds {
  const normalized = new Date(anchor);
  normalized.setHours(0, 0, 0, 0);

  if (view === "1") {
    const day = normalized;
    const next = addDays(day, 1);
    return {
      view,
      anchor: day,
      days: [day],
      rangeStart: day.toISOString(),
      rangeEnd: next.toISOString(),
      periodLabel: day.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      dateParam: toDayParam(day),
    };
  }

  if (view === "5") {
    const periodStart = startOfWeek(normalized, 1);
    const days = Array.from({ length: 5 }, (_, index) => addDays(periodStart, index));
    const periodEnd = addDays(periodStart, 5);

    return {
      view,
      anchor: normalized,
      days,
      rangeStart: periodStart.toISOString(),
      rangeEnd: periodEnd.toISOString(),
      periodLabel: formatWeekRange(days),
      dateParam: toDayParam(periodStart),
    };
  }

  if (view === "month") {
    const monthStart = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
    const gridStart = startOfWeek(monthStart, 0);
    const lastDayOfMonth = new Date(normalized.getFullYear(), normalized.getMonth() + 1, 0);
    const gridEnd = addDays(startOfWeek(lastDayOfMonth, 0), 7);
    const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS);
    const days = Array.from({ length: dayCount }, (_, index) => addDays(gridStart, index));

    return {
      view,
      anchor: normalized,
      days,
      rangeStart: gridStart.toISOString(),
      rangeEnd: gridEnd.toISOString(),
      periodLabel: normalized.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      dateParam: toDayParam(monthStart),
    };
  }

  const periodStart = startOfWeek(normalized, 0);
  const days = Array.from({ length: 7 }, (_, index) => addDays(periodStart, index));
  const periodEnd = addDays(periodStart, 7);

  return {
    view,
    anchor: normalized,
    days,
    rangeStart: periodStart.toISOString(),
    rangeEnd: periodEnd.toISOString(),
    periodLabel: formatWeekRange(days),
    dateParam: toDayParam(periodStart),
  };
}

export function shiftCalendarPeriod(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  const normalized = new Date(anchor);
  normalized.setHours(0, 0, 0, 0);

  if (view === "month") {
    return new Date(normalized.getFullYear(), normalized.getMonth() + direction, 1);
  }

  if (view === "1") {
    return addDays(normalized, direction);
  }

  if (view === "5") {
    const periodStart = startOfWeek(normalized, 1);
    return addDays(periodStart, direction * 7);
  }

  const periodStart = startOfWeek(normalized, 0);
  return addDays(periodStart, direction * 7);
}

export function getTodayAnchor(view: CalendarView): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (view === "month") {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  if (view === "1") {
    return today;
  }

  if (view === "5") {
    return startOfWeek(today, 1);
  }

  return startOfWeek(today, 0);
}

export function buildCalendarHref(view: CalendarView, date: Date) {
  const bounds = getCalendarBounds(view, date);
  return `/calendar?view=${view}&date=${bounds.dateParam}`;
}

export function getMonthMeta(anchor: Date) {
  return {
    month: anchor.getMonth(),
    year: anchor.getFullYear(),
  };
}

export function getCalendarNavLinks(view: CalendarView, anchor: Date) {
  return {
    prevHref: buildCalendarHref(view, shiftCalendarPeriod(view, anchor, -1)),
    nextHref: buildCalendarHref(view, shiftCalendarPeriod(view, anchor, 1)),
    todayHref: buildCalendarHref(view, getTodayAnchor(view)),
    viewHrefs: {
      "1": buildCalendarHref("1", view === "1" ? anchor : getTodayAnchor("1")),
      "5": buildCalendarHref("5", anchor),
      "7": buildCalendarHref("7", anchor),
      month: buildCalendarHref("month", anchor),
    } as Record<CalendarView, string>,
  };
}

/** Breakpoint-aware default when user has not chosen a view yet. */
export function preferredDefaultView(width: number): CalendarView {
  if (width < 640) {
    return "1";
  }
  if (width < 1024) {
    return "5";
  }
  return "7";
}
