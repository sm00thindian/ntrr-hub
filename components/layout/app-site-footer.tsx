"use client";

import { useEffect, useState } from "react";

import {
  FooterSyncCard,
  type FooterSyncStatus,
} from "@/components/layout/footer-sync-card";
import { fetchFooterSyncStatus } from "@/lib/integrations/status-actions";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "support@ntrr.com";

type AppSiteFooterProps = {
  className?: string;
  householdId?: string | null;
  canSync?: boolean;
};

/**
 * App chrome footer: quiet brand line + compact calendar sync card.
 * Sync status loads after paint so shared layout navigation stays snappy.
 */
export function AppSiteFooter({
  className,
  householdId,
  canSync = false,
}: AppSiteFooterProps) {
  const [syncStatus, setSyncStatus] = useState<FooterSyncStatus | null>(null);

  useEffect(() => {
    if (!householdId) {
      setSyncStatus(null);
      return;
    }

    let cancelled = false;
    void fetchFooterSyncStatus().then((status) => {
      if (!cancelled) {
        setSyncStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const showSync = Boolean(householdId);

  return (
    <footer
      className={cn(
        "mt-auto border-t border-border/60 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-4 lg:px-8">
        {showSync && householdId ? (
          syncStatus ? (
            <FooterSyncCard
              householdId={householdId}
              status={syncStatus}
              canSync={canSync}
              onStatusChange={setSyncStatus}
            />
          ) : (
            <div
              className="rounded-lg border bg-card/80 px-2.5 py-2 shadow-sm"
              data-testid="footer-sync"
              aria-label="Calendar sync status"
            >
              <p className="text-muted-foreground text-[11px] leading-tight">Sync · …</p>
            </div>
          )
        ) : null}

        <div className="flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <div className="space-y-0.5">
            <p>
              A{" "}
              <a
                href="https://ntrr.com"
                className="underline-offset-2 hover:text-foreground hover:underline"
                rel="noopener noreferrer"
              >
                Not The Runaround
              </a>{" "}
              service
            </p>
            <p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              {" · "}
              <a
                href="https://reliant.ntrr.com"
                className="underline-offset-2 hover:text-foreground hover:underline"
                rel="noopener noreferrer"
              >
                Reliant
              </a>
            </p>
          </div>
          <p className="sm:text-right">© {new Date().getFullYear()} Not The Runaround</p>
        </div>
      </div>
    </footer>
  );
}
