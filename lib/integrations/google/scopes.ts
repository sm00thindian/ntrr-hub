/**
 * Google OAuth scopes for Hub.
 *
 * Calendar is **read-only**: list calendars (multi-select) + pull events into Hub.
 * Hub is not a calendar editor; tasks stay in Hub (Google Tasks sync is separate and off).
 *
 * @see https://developers.google.com/workspace/calendar/api/auth
 */

/** List calendars the account can see — powers multi-calendar selection in Settings. */
export const GOOGLE_CALENDAR_LIST_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

/** Read events on calendars the user can access — pull into Focus / Calendar views. */
export const GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";

/**
 * Full calendar read/write (edit, share, delete calendars).
 * No longer requested. Kept so we can detect dogfood connections that still need reconnect.
 */
export const GOOGLE_CALENDAR_FULL_SCOPE = "https://www.googleapis.com/auth/calendar";

/** @deprecated Use GOOGLE_CALENDAR_FULL_SCOPE — alias for older imports. */
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_FULL_SCOPE;

/** Kept for reference; Google Tasks sync is disabled (Hub is task source of truth). */
export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

/** Scopes requested on Connect / Reconnect. */
export const GOOGLE_INTEGRATION_SCOPES = [
  GOOGLE_CALENDAR_LIST_READONLY_SCOPE,
  GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE,
] as const;

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** True when stored scopes match current read-only calendar grant (or supersets). */
export function hasGoogleReadonlyCalendarScopes(scopes: string[] | null | undefined): boolean {
  if (!scopes?.length) {
    return false;
  }
  const joined = scopes.join(" ");
  // Full legacy scope also allows list + events; treat as "works" but UI may still nudge reconnect.
  if (joined.includes(GOOGLE_CALENDAR_FULL_SCOPE)) {
    return true;
  }
  const hasList =
    joined.includes("calendar.calendarlist.readonly") ||
    joined.includes("calendar.calendarlist");
  const hasEvents =
    joined.includes("calendar.events.readonly") || joined.includes("calendar.events");
  return hasList && hasEvents;
}

/** True when connection still has the old full-write calendar scope (or missing scopes). */
export function googleConnectionNeedsScopeReconnect(
  scopes: string[] | null | undefined,
): boolean {
  if (!scopes?.length) {
    return true;
  }
  const joined = scopes.join(" ");
  // Prefer explicit read-only pair; nudge anyone still on full-only grant.
  const hasReadonlyPair =
    joined.includes("calendar.calendarlist.readonly") &&
    joined.includes("calendar.events.readonly");
  if (hasReadonlyPair) {
    return false;
  }
  return true;
}
