import {
  addDaysToWallDate,
  combineWallDateTime,
  formatWallDate,
  resolveHouseholdTimeZone,
  zonedWallTimeToUtcIso,
} from "@/lib/datetime/timezone";
import type { RecurrenceCadence } from "@/lib/tasks/types";

/** Parse HH:mm; returns null if empty/invalid */
export function parseDueTime(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Day of week for a civil YYYY-MM-DD (0 = Sunday … 6 = Saturday). */
function wallDateDayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) {
    return 0;
  }
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Next due instant for a recurring template, as UTC ISO.
 * Uses household wall clock. If `dueTime` is null, returns null (no due time).
 */
export function nextRecurringDueAt(params: {
  cadence: RecurrenceCadence;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dueTime: string | null;
  timeZone: string;
  now?: Date;
}): string | null {
  const dueTime = parseDueTime(params.dueTime);
  if (!dueTime) {
    return null;
  }

  const zone = resolveHouseholdTimeZone(params.timeZone);
  const now = params.now ?? new Date();
  const live = getZonedPartsSafe(now, zone);
  let date = formatWallDate(live.year, live.month, live.day);

  const maxScan = 370; // enough for monthly edge cases

  for (let i = 0; i < maxScan; i++) {
    if (occurrenceMatchesDay(params.cadence, params.dayOfWeek, params.dayOfMonth, date)) {
      const wall = combineWallDateTime(date, dueTime);
      const iso = zonedWallTimeToUtcIso(wall, zone);
      if (iso && Date.parse(iso) > now.getTime()) {
        return iso;
      }
    }
    date = addDaysToWallDate(date, 1);
  }

  return null;
}

function getZonedPartsSafe(date: Date, timeZone: string) {
  // Mirror zonedNowParts but for arbitrary instant (duplicate of private getZonedParts usage)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveHouseholdTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function occurrenceMatchesDay(
  cadence: RecurrenceCadence,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  date: string,
): boolean {
  if (cadence === "daily") {
    return true;
  }
  if (cadence === "weekly") {
    const target = dayOfWeek ?? 1;
    return wallDateDayOfWeek(date) === target;
  }
  if (cadence === "monthly") {
    const target = dayOfMonth ?? 1;
    const day = Number(date.split("-")[2]);
    return day === target;
  }
  return false;
}
