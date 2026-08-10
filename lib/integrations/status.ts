import { getHouseholdIntegration } from "@/lib/integrations/queries";
import type { IntegrationAccount } from "@/lib/integrations/types";
import { getPendingConflictCount } from "@/lib/sync/conflict";

export type ProviderSyncSnapshot = {
  provider: "google" | "apple_caldav";
  label: string;
  status: IntegrationAccount["status"] | "not_connected";
  lastSyncedAt: string | null;
  needsReconnect: boolean;
  connectedEmail?: string | null;
};

export type HouseholdSyncStatus = {
  providers: ProviderSyncSnapshot[];
  conflictCount: number;
  /** Most recent successful sync across providers */
  lastSyncedAt: string | null;
  anyConnected: boolean;
  anyNeedsReconnect: boolean;
};

function googleLastSyncedAt(account: IntegrationAccount): string | null {
  const fromMeta = account.metadata.google?.lastSyncedAt;
  if (typeof fromMeta === "string" && fromMeta) {
    return fromMeta;
  }
  // Fall back to row updated_at when status is healthy
  if (account.status === "connected") {
    return account.updatedAt;
  }
  return null;
}

function appleLastSyncedAt(account: IntegrationAccount): string | null {
  const fromMeta = account.metadata.apple?.caldav?.lastSyncedAt;
  if (typeof fromMeta === "string" && fromMeta) {
    return fromMeta;
  }
  if (account.status === "connected") {
    return account.updatedAt;
  }
  return null;
}

function snapshotGoogle(account: IntegrationAccount | null): ProviderSyncSnapshot {
  if (!account) {
    return {
      provider: "google",
      label: "Google",
      status: "not_connected",
      lastSyncedAt: null,
      needsReconnect: false,
    };
  }

  const needsReconnect = account.status === "error" || account.status === "disconnected";

  return {
    provider: "google",
    label: "Google",
    status: account.status,
    lastSyncedAt: googleLastSyncedAt(account),
    needsReconnect: needsReconnect || account.status === "error",
    connectedEmail: account.metadata.tokens?.connectedEmail ?? null,
  };
}

function snapshotApple(account: IntegrationAccount | null): ProviderSyncSnapshot {
  if (!account) {
    return {
      provider: "apple_caldav",
      label: "Apple",
      status: "not_connected",
      lastSyncedAt: null,
      needsReconnect: false,
    };
  }

  return {
    provider: "apple_caldav",
    label: "Apple",
    status: account.status,
    lastSyncedAt: appleLastSyncedAt(account),
    needsReconnect: account.status === "error" || account.status === "disconnected",
  };
}

export async function getHouseholdSyncStatus(householdId: string): Promise<HouseholdSyncStatus> {
  try {
    const [google, apple, conflictCount] = await Promise.all([
      getHouseholdIntegration(householdId, "google").catch(() => null),
      getHouseholdIntegration(householdId, "apple_caldav").catch(() => null),
      getPendingConflictCount(householdId).catch(() => 0),
    ]);

    const providers = [snapshotGoogle(google), snapshotApple(apple)];

    const lastSyncedTimes = providers
      .map((p) => p.lastSyncedAt)
      .filter((t): t is string => Boolean(t))
      .map((t) => Date.parse(t))
      .filter((n) => Number.isFinite(n));

    const lastSyncedAt =
      lastSyncedTimes.length > 0
        ? new Date(Math.max(...lastSyncedTimes)).toISOString()
        : null;

    return {
      providers,
      conflictCount,
      lastSyncedAt,
      anyConnected: providers.some((p) => p.status === "connected"),
      anyNeedsReconnect: providers.some((p) => p.needsReconnect),
    };
  } catch {
    return {
      providers: [snapshotGoogle(null), snapshotApple(null)],
      conflictCount: 0,
      lastSyncedAt: null,
      anyConnected: false,
      anyNeedsReconnect: false,
    };
  }
}
