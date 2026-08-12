export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
/** Kept for reference; Google Tasks sync is disabled (Hub is task source of truth). */
export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

/** Calendar only — family tasks stay in Hub (see GOOGLE_TASKS_SYNC_ENABLED). */
export const GOOGLE_INTEGRATION_SCOPES = [GOOGLE_CALENDAR_SCOPE];

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}