"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { syncGoogleNow } from "@/lib/integrations/actions";
import { fetchFooterSyncStatus } from "@/lib/integrations/status-actions";
import { cn } from "@/lib/utils";

/** Serializable — same shape as dashboard sync panel / status lib. */
export type FooterProviderSync = {
  provider: "google" | "apple_caldav";
  label: string;
  status: "connected" | "disconnected" | "error" | "pending" | "not_connected";
  lastSyncedAt: string | null;
  needsReconnect: boolean;
};

export type FooterSyncStatus = {
  providers: FooterProviderSync[];
  conflictCount: number;
  lastSyncedAt: string | null;
  anyConnected: boolean;
  anyNeedsReconnect: boolean;
};

type FooterSyncCardProps = {
  householdId: string;
  status: FooterSyncStatus;
  canSync: boolean;
  onStatusChange?: (status: FooterSyncStatus | null) => void;
};

function formatRelative(iso: string | null) {
  if (!iso) {
    return "never";
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return "unknown";
  }
  const delta = Date.now() - ms;
  if (delta < 60_000) {
    return "just now";
  }
  if (delta < 60 * 60_000) {
    return `${Math.floor(delta / 60_000)}m ago`;
  }
  if (delta < 24 * 60 * 60_000) {
    return `${Math.floor(delta / (60 * 60_000))}h ago`;
  }
  return `${Math.floor(delta / (24 * 60 * 60_000))}d ago`;
}

/**
 * Compact footer card: calendar sync health + optional Sync now.
 * Intentionally quiet — not a dashboard panel.
 */
export function FooterSyncCard({
  householdId,
  status,
  canSync,
  onStatusChange,
}: FooterSyncCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const connected = status.providers.filter((p) => p.status === "connected");
  const canRunSync = canSync && connected.some((p) => p.provider === "google");
  const lastLabel = mounted ? formatRelative(status.lastSyncedAt) : "…";

  let summary: string;
  if (status.anyNeedsReconnect) {
    summary = "Reconnect needed";
  } else if (!status.anyConnected) {
    summary = "No calendar connected";
  } else if (status.conflictCount > 0) {
    summary = `${status.conflictCount} conflict${status.conflictCount === 1 ? "" : "s"} · ${lastLabel}`;
  } else {
    summary = `Last sync ${lastLabel}`;
  }

  const providerHint = status.providers
    .filter((p) => p.status === "connected" || p.needsReconnect)
    .map((p) => p.label)
    .join(" · ");

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 px-2.5 py-2 shadow-sm",
        status.anyNeedsReconnect && "border-destructive/40 bg-destructive/5",
      )}
      data-testid="footer-sync"
      aria-label="Calendar sync status"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium leading-tight text-foreground/90">
            Sync
            {providerHint ? (
              <span className="text-muted-foreground font-normal"> · {providerHint}</span>
            ) : null}
          </p>
          <p
            className={cn(
              "truncate text-[10px] leading-tight",
              status.anyNeedsReconnect ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {summary}
            {status.conflictCount > 0 ? (
              <>
                {" · "}
                <Link href="/conflicts" className="text-brand font-medium hover:underline">
                  Review
                </Link>
              </>
            ) : null}
            {!status.anyConnected ? (
              <>
                {" · "}
                <Link href="/settings" className="text-brand font-medium hover:underline">
                  Settings
                </Link>
              </>
            ) : null}
            {status.anyNeedsReconnect ? (
              <>
                {" · "}
                <Link href="/settings" className="text-brand font-medium hover:underline">
                  Fix
                </Link>
              </>
            ) : null}
          </p>
        </div>

        {canRunSync ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-7 shrink-0 px-2 text-[11px]"
            onClick={() =>
              startTransition(async () => {
                await syncGoogleNow();
                const next = await fetchFooterSyncStatus();
                if (next) {
                  onStatusChange?.(next);
                }
                // Soft refresh destination pages without blocking the footer control.
                router.refresh();
              })
            }
            aria-label={pending ? "Syncing calendars" : "Sync calendars now"}
          >
            <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} aria-hidden />
            {pending ? "…" : "Sync now"}
          </Button>
        ) : null}
      </div>
      {/* householdId reserved for future live refresh without full page poll */}
      <span className="sr-only" data-household-id={householdId}>
        Household sync
      </span>
    </div>
  );
}
