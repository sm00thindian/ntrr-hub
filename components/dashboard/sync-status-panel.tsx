"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { syncGoogleNow } from "@/lib/integrations/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const REFRESH_POLL_MS = 45_000;

/** Serializable snapshot — keep types local so this client module never imports server queries. */
export type ProviderSyncSnapshot = {
  provider: "google" | "apple_caldav";
  label: string;
  status: "connected" | "disconnected" | "error" | "pending" | "not_connected";
  lastSyncedAt: string | null;
  needsReconnect: boolean;
  connectedEmail?: string | null;
};

export type HouseholdSyncStatus = {
  providers: ProviderSyncSnapshot[];
  conflictCount: number;
  lastSyncedAt: string | null;
  anyConnected: boolean;
  anyNeedsReconnect: boolean;
};

type SyncStatusPanelProps = {
  householdId: string;
  status: HouseholdSyncStatus;
  canSync: boolean;
  timeZone?: string;
};

function formatRelative(iso: string | null) {
  if (!iso) {
    return "Never";
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return "Unknown";
  }
  const delta = Date.now() - ms;
  if (delta < 60_000) {
    return "Just now";
  }
  if (delta < 60 * 60_000) {
    const m = Math.floor(delta / 60_000);
    return `${m}m ago`;
  }
  if (delta < 24 * 60 * 60_000) {
    const h = Math.floor(delta / (60 * 60_000));
    return `${h}h ago`;
  }
  const d = Math.floor(delta / (24 * 60 * 60_000));
  return `${d}d ago`;
}

function providerLine(p: ProviderSyncSnapshot, relativeLabel: string) {
  if (p.status === "not_connected") {
    return `${p.label}: not connected`;
  }
  if (p.needsReconnect || p.status === "error") {
    return `${p.label}: reconnect needed`;
  }
  if (p.status === "connected") {
    return `${p.label}: synced ${relativeLabel}`;
  }
  return `${p.label}: ${p.status}`;
}

/**
 * Sync health + conflicts. Near real-time: Supabase realtime on integrations/conflicts
 * plus a light poll so last-sync times stay fresh after cron/sync.
 */
export function SyncStatusPanel({
  householdId,
  status,
  canSync,
}: SyncStatusPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Relative times only after mount to avoid SSR/client hydration mismatches.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let poll = 0;

    try {
      const supabase = createClient();
      channel = supabase
        .channel(`sync-status:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "integration_accounts",
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            if (!cancelled) {
              startTransition(() => router.refresh());
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sync_conflicts",
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            if (!cancelled) {
              startTransition(() => router.refresh());
            }
          },
        )
        .subscribe();

      poll = window.setInterval(() => {
        if (!cancelled) {
          startTransition(() => router.refresh());
        }
      }, REFRESH_POLL_MS);
    } catch {
      // Realtime optional — panel still shows last server-rendered status.
    }

    return () => {
      cancelled = true;
      if (poll) {
        window.clearInterval(poll);
      }
      if (channel) {
        try {
          const supabase = createClient();
          void supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, [householdId, router]);

  const reconnectProviders = status.providers.filter((p) => p.needsReconnect);
  const lastSyncLabel = mounted ? formatRelative(status.lastSyncedAt) : "…";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync status</CardTitle>
        <CardDescription>
          Calendar context from Google and Apple. Hub does not replace those apps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.anyNeedsReconnect ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            role="alert"
          >
            <p className="font-medium text-destructive">
              {reconnectProviders.map((p) => p.label).join(" & ")} need
              {reconnectProviders.length === 1 ? "s" : ""} reconnect
            </p>
            <Link
              href="/settings"
              className="text-brand mt-1 inline-block text-sm font-medium hover:underline"
            >
              Open Settings to reconnect →
            </Link>
          </div>
        ) : null}

        {status.conflictCount > 0 ? (
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-brand text-2xl font-semibold">{status.conflictCount}</span>{" "}
              <span className="text-muted-foreground">
                pending conflict{status.conflictCount === 1 ? "" : "s"}
              </span>
            </p>
            <Link href="/conflicts" className="text-brand text-sm font-medium hover:underline">
              Review conflicts →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status.anyConnected
              ? `No conflicts · last sync ${lastSyncLabel}`
              : "No calendars connected yet."}
          </p>
        )}

        <ul className="space-y-1 text-xs text-muted-foreground">
          {status.providers.map((p) => (
            <li
              key={p.provider}
              className={cn(
                p.needsReconnect && "font-medium text-destructive",
                p.status === "connected" && "text-foreground/80",
              )}
            >
              {providerLine(p, mounted ? formatRelative(p.lastSyncedAt) : "…")}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          {canSync && status.providers.some((p) => p.status === "connected") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await syncGoogleNow();
                  router.refresh();
                })
              }
            >
              <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
              {pending ? "Syncing…" : "Sync now"}
            </Button>
          ) : null}
          {!status.anyConnected ? (
            <Button asChild size="sm">
              <Link href="/settings">Connect calendar</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
