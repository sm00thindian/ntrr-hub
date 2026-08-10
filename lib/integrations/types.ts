export type GoogleTokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedEmail?: string;
};

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
};

export type GoogleSyncState = {
  /** @deprecated Use calendarSyncTokens per calendar */
  calendarSyncToken?: string;
  calendarSyncTokens?: Record<string, string>;
  selectedCalendarIds?: string[];
  calendars?: GoogleCalendarInfo[];
  tasksSyncToken?: string;
  defaultTaskListId?: string;
  /** Bumped when calendar pull logic changes — forces a ranged re-sync */
  calendarSyncVersion?: number;
  /** Last successful pull/push cycle (ISO) */
  lastSyncedAt?: string;
};

export type AppleCalDavCredentials = {
  appleId: string;
  appPassword: string;
};

export type AppleCalDavState = {
  calendarUrl?: string;
  calendarName?: string;
  lastSyncedAt?: string;
};

export type IntegrationMetadata = {
  tokens?: GoogleTokenBundle;
  google?: GoogleSyncState;
  apple?: {
    credentials?: AppleCalDavCredentials;
    caldav?: AppleCalDavState;
  };
};

export type IntegrationAccount = {
  id: string;
  householdId: string;
  provider: "google" | "microsoft" | "apple_caldav" | "zapier";
  status: "connected" | "disconnected" | "error" | "pending";
  scopes: string[] | null;
  metadata: IntegrationMetadata;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};