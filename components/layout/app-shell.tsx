import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/layout/app-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { HouseholdRole } from "@/lib/permissions/roles";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
  householdName?: string | null;
  householdRole?: HouseholdRole | null;
};

export function AppShell({
  children,
  userEmail,
  householdName,
  householdRole,
}: AppShellProps) {
  const subtitle = householdName
    ? `${householdName}${householdRole ? ` · ${householdRole}` : ""}`
    : "Family Care Orchestrator";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-56 shrink-0 border-r px-4 py-6 lg:flex lg:flex-col">
          <div className="mb-8">
            <Logo href="/dashboard" size="lg" />
            <p className="mt-1 text-xs text-sidebar-muted">Family coordination</p>
          </div>
          <AppNav variant="sidebar" />
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
          <header className="safe-top sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="lg:hidden">
                  <Logo href="/dashboard" size="md" />
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  <p className="truncate text-sm font-medium tracking-tight">Hub</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {userEmail ? (
                  <span
                    className="hidden max-w-[12rem] truncate text-xs text-muted-foreground sm:inline"
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

          <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">{children}</main>

          <div className="hidden lg:block">
            <SiteFooter className="border-t border-border/60" />
          </div>
        </div>
      </div>

      <AppNav variant="bottom" />
    </div>
  );
}
