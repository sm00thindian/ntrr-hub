import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/layout/app-nav";
import { AppSiteFooter } from "@/components/layout/app-site-footer";
import type { FooterSyncStatus } from "@/components/layout/footer-sync-card";
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
  /** Compact footer sync (hidden on /calendar and My day) */
  syncStatus?: FooterSyncStatus | null;
  canSync?: boolean;
};

export function AppShell({
  children,
  userEmail,
  householdName,
  householdRole,
  householdPersona,
  householdId,
  conflictCount = 0,
  syncStatus = null,
  canSync = false,
}: AppShellProps) {
  const myDayMode = householdPersona ? prefersMyDayView(householdPersona) : false;
  const subtitle = householdName
    ? `${householdName}${householdRole ? ` · ${householdRole}` : ""}`
    : "Family Care Orchestrator";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-56 shrink-0 border-r px-4 py-6 lg:flex lg:flex-col">
          <div className="mb-8">
            <Logo href="/dashboard" size="lg" />
            <p className="mt-1 text-xs text-sidebar-muted">
              {myDayMode ? "Your day" : "Family coordination"}
            </p>
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
                <div className="lg:hidden">
                  <Logo href="/dashboard" size="md" />
                </div>
                <div className="min-w-0 lg:hidden">
                  {householdName ? (
                    <p className="truncate text-xs font-medium leading-tight">{householdName}</p>
                  ) : null}
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  <p className="truncate text-sm font-medium tracking-tight">
                    {myDayMode ? "My day" : "Hub"}
                  </p>
                </div>
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
                {userEmail ? (
                  <span
                    className="hidden max-w-[12rem] truncate text-xs text-muted-foreground md:inline"
                    title={userEmail}
                  >
                    {userEmail}
                  </span>
                ) : null}
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
            <AppSiteFooter
              householdId={householdId}
              syncStatus={syncStatus}
              canSync={canSync}
              myDayMode={myDayMode}
            />
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
