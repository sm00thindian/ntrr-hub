/** Common IANA zones for Hub household display (extend as needed). */
export const HOUSEHOLD_TIMEZONE_OPTIONS = [
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_HOUSEHOLD_TIMEZONE = "America/Chicago";

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value?.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveHouseholdTimeZone(value: string | null | undefined): string {
  return isValidTimeZone(value) ? value : DEFAULT_HOUSEHOLD_TIMEZONE;
}

export function formatTimeInZone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: resolveHouseholdTimeZone(timeZone),
    ...options,
  });
}

export function formatDateInZone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: resolveHouseholdTimeZone(timeZone),
    ...options,
  });
}

export function formatDateTimeInZone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: resolveHouseholdTimeZone(timeZone),
    ...options,
  });
}

/** Compact clock e.g. 3p or 3:30p in household zone */
export function formatClockCompactInZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: resolveHouseholdTimeZone(timeZone),
  }).formatToParts(new Date(iso));

  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const dayPeriod = (parts.find((part) => part.type === "dayPeriod")?.value ?? "AM")
    .toLowerCase()
    .startsWith("a")
    ? "a"
    : "p";

  if (minute === "00") {
    return `${hour}${dayPeriod}`;
  }

  return `${hour}:${minute}${dayPeriod}`;
}

/** YYYY-MM-DD for an instant in a given zone (for day bucketing) */
export function calendarDateKeyInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveHouseholdTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Start/end of the calendar day containing `now` in `timeZone`, as UTC ISO strings.
 * Used so "today's agenda" matches the household wall clock, not Vercel UTC midnight.
 */
export function getZonedDayBounds(timeZone: string, now = new Date()) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const dayKey = calendarDateKeyInZone(now.toISOString(), zone);

  // Local civil days can sit up to ~14h off UTC; scan a window and find [start, end).
  const probe = new Date(`${dayKey}T12:00:00.000Z`).getTime();
  const searchStart = probe - 36 * 60 * 60 * 1000;
  const searchEnd = probe + 36 * 60 * 60 * 1000;

  let startMs: number | null = null;
  let endMs: number | null = null;

  for (let t = searchStart; t <= searchEnd; t += 60_000) {
    const key = calendarDateKeyInZone(new Date(t).toISOString(), zone);
    if (key === dayKey) {
      if (startMs === null) {
        startMs = t;
      }
      endMs = t + 60_000;
    } else if (startMs !== null) {
      break;
    }
  }

  if (startMs === null || endMs === null) {
    // Fallback: UTC day (should be rare)
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: start.toISOString(), end: end.toISOString(), dayKey };
  }

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    dayKey,
  };
}

/** Chronological sort key; invalid dates sort last */
export function agendaSortTimeMs(iso: string | null | undefined): number {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function getZonedParts(date: Date, timeZone: string) {
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Current wall clock parts in household timezone */
export function zonedNowParts(timeZone: string) {
  return getZonedParts(new Date(), resolveHouseholdTimeZone(timeZone));
}

/** Wall date (YYYY-MM-DD) and time (HH:mm) for an ISO instant in household timezone */
export function isoToWallDateTime(
  iso: string,
  timeZone: string,
): { date: string; time: string } {
  const parts = getZonedParts(new Date(iso), resolveHouseholdTimeZone(timeZone));
  return {
    date: formatWallDate(parts.year, parts.month, parts.day),
    time: formatWallTime(parts.hour, parts.minute),
  };
}

/** YYYY-MM-DD for a wall date */
export function formatWallDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** HH:mm for a wall time */
export function formatWallTime(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Combine date + time for datetime-local / server parse */
export function combineWallDateTime(date: string, time: string): string {
  if (!date) {
    return "";
  }
  const t = time || "09:00";
  return `${date}T${t.length === 5 ? t : t.slice(0, 5)}`;
}

/** Add calendar days to a wall date (YYYY-MM-DD), returns YYYY-MM-DD */
export function addDaysToWallDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) {
    return date;
  }
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return formatWallDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

/**
 * Parse `datetime-local` value (YYYY-MM-DDTHH:mm) as wall time in household timezone → UTC ISO.
 * Critical: server-side `new Date("2026-08-10T15:00")` is UTC on Vercel, not household time.
 */
export function zonedWallTimeToUtcIso(
  localDateTime: string,
  timeZone: string,
): string | null {
  const match = localDateTime
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) {
    return null;
  }

  const zone = resolveHouseholdTimeZone(timeZone);
  // Initial guess: treat wall components as UTC, then correct by zone offset iteratively
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(guess), zone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asIfUtc;
    guess += delta;
    if (delta === 0) {
      break;
    }
  }

  // Verify wall clock matches (handles rare DST edges)
  const check = getZonedParts(new Date(guess), zone);
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    // Fall back: try ±1h for DST ambiguity
    for (const offset of [-3600000, 3600000, -7200000, 7200000]) {
      const candidate = guess + offset;
      const p = getZonedParts(new Date(candidate), zone);
      if (
        p.year === year &&
        p.month === month &&
        p.day === day &&
        p.hour === hour &&
        p.minute === minute
      ) {
        return new Date(candidate).toISOString();
      }
    }
  }

  return new Date(guess).toISOString();
}

/** True if due time is midnight in household zone (date-only style) */
export function isMidnightInZone(iso: string, timeZone: string): boolean {
  const parts = getZonedParts(new Date(iso), resolveHouseholdTimeZone(timeZone));
  return parts.hour === 0 && parts.minute === 0 && parts.second === 0;
}

export function householdTimeZoneLabel(timeZone: string): string {
  const zone = resolveHouseholdTimeZone(timeZone);
  const option = HOUSEHOLD_TIMEZONE_OPTIONS.find((o) => o.value === zone);
  return option?.label ?? zone;
}
