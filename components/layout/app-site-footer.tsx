"use client";

import {
  FooterSyncCard,
  type FooterSyncStatus,
} from "@/components/layout/footer-sync-card";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "support@ntrr.com";

type AppSiteFooterProps = {
  className?: string;
  householdId?: string | null;
  syncStatus?: FooterSyncStatus | null;
  canSync?: boolean;
  /** Self-advocate My day: no household sync chrome */
  myDayMode?: boolean;
};

/**
 * App chrome footer: quiet brand line + compact sync card on all app routes
 * (including calendar). Hidden for self-advocate My day persona.
 */
export function AppSiteFooter({
  className,
  householdId,
  syncStatus,
  canSync = false,
  myDayMode = false,
}: AppSiteFooterProps) {
  const showSync = !myDayMode && Boolean(householdId) && Boolean(syncStatus);

  return (
    <footer
      className={cn(
        "mt-auto border-t border-border/60 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-4 lg:px-8">
        {showSync && householdId && syncStatus ? (
          <FooterSyncCard
            householdId={householdId}
            status={syncStatus}
            canSync={canSync}
          />
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
                Not The Run Around
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
          <p className="sm:text-right">© {new Date().getFullYear()} Not The Run Around</p>
        </div>
      </div>
    </footer>
  );
}
