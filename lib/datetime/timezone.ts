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
