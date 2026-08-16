import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/layout/app-nav";
import { AppSiteFooter } from "@/components/layout/app-site-footer";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { HouseholdPersona, HouseholdRole } from "@/lib/permissions/roles";
import { prefersMyDayView } from "@/lib/permissions/roles";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
  householdName?: string | null;
  householdRole?: HouseholdRole | null;
  householdPersona?: HouseholdPersona | null;
  householdId?: string | null;
  conflictCount?: number;
  canSync?: boolean;
};

/**
 * App chrome rules (NTRR):
 * - Product mark once per viewport (sidebar desktop / header mobile).
 * - Account email once on desktop (sidebar only) — not also top-right.
 * - Header = place (household); mode lives in nav + page H1.
 */
export function AppShell({
  children,
  userEmail,
  householdName,
  householdRole,
  householdPersona,
  householdId,
  conflictCount = 0,
  canSync = false,
}: AppShellProps) {
  const myDayMode = householdPersona ? prefersMyDayView(householdPersona) : false;
  // Sidebar/header place context — household name, not another "My day" synonym.
  const placeLabel = householdName?.trim() || null;
  const caregiverHeaderDetail =
    placeLabel && householdRole ? `${placeLabel} · ${householdRole}` : placeLabel;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-56 shrink-0 border-r px-4 py-6 lg:flex lg:flex-col">
          <div className="mb-8">
            <Logo href="/dashboard" size="lg" />
            {placeLabel ? (
              <p className="text-sidebar-muted mt-2 truncate text-xs" title={placeLabel}>
                {placeLabel}
              </p>
            ) : !myDayMode ? (
              <p className="text-sidebar-muted mt-2 text-xs">Family coordination</p>
            ) : null}
          </div>
          <AppNav
            variant="sidebar"
            householdId={householdId}
            conflictCount={myDayMode ? 0 : conflictCount}
            myDayMode={myDayMode}
          />
          <div className="border-sidebar-border mt-auto space-y-3 border-t pt-4">
            {userEmail ? (
              <p className="text-sidebar-muted truncate text-xs leading-relaxed" title={userEmail}>
                {userEmail}
              </p>
            ) : null}
            <SignOutButton className="text-sidebar-muted hover:bg-sidebar-accent hover:text-foreground" />
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="safe-top sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
            <div className="flex h-12 items-center justify-between gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/*
                  NTRR chrome: one product mark at a time.
                  Mobile: logo in top bar (sidebar hidden).
                  Desktop (lg+): logo lives in the sidebar only — header is place only.
                */}
                <Logo href="/dashboard" size="md" className="lg:hidden" />
                {placeLabel || (!myDayMode && caregiverHeaderDetail) ? (
                  <div className="min-w-0 border-l border-border/80 pl-2.5 sm:pl-3 lg:border-l-0 lg:pl-0">
                    <p className="truncate text-xs text-muted-foreground">
                      {myDayMode ? placeLabel : caregiverHeaderDetail}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {!myDayMode && conflictCount > 0 ? (
                  <a
                    href="/conflicts"
                    className="bg-destructive/10 text-destructive hover:bg-destructive/15 inline-flex h-8 items-center rounded-full px-2 text-xs font-semibold transition-colors sm:px-2.5"
                  >
                    <span className="sm:hidden">{conflictCount}</span>
                    <span className="hidden sm:inline">
                      {conflictCount} conflict{conflictCount === 1 ? "" : "s"}
                    </span>
                  </a>
                ) : null}
                {/* Account: sidebar on desktop; Sign out only on mobile (no duplicate email). */}
                <div className="lg:hidden">
                  <SignOutButton variant="ghost" />
                </div>
              </div>
            </div>
          </header>

          {/* Extra bottom padding on small screens for bottom nav + footer sync */}
          <main className="flex-1 px-3 py-4 pb-4 sm:px-4 sm:py-6 lg:px-8 lg:pb-8">
            {children}
          </main>

          <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
            <AppSiteFooter householdId={householdId} canSync={canSync} />
          </div>
        </div>
      </div>

      <AppNav
        variant="bottom"
        householdId={householdId}
        conflictCount={myDayMode ? 0 : conflictCount}
        myDayMode={myDayMode}
      />
    </div>
  );
}
