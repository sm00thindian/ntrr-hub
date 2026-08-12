/**
 * Google Tasks bidirectional sync.
 *
 * Disabled: Hub is the source of truth for family tasks. Syncing to Google Tasks
 * caused origin mislabels, complete/undo races, and confusion vs calendar context.
 * Google Calendar (events) continues to sync for schedule context.
 *
 * Flip to true only with an explicit product decision and a re-tested conflict model.
 */
export const GOOGLE_TASKS_SYNC_ENABLED = false;
