"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Home, ListTodo, Settings, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const coordinatorNav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/family", label: "Family", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** Self-advocate: calm day focus; Family still available read-only for context */
const myDayNav = [
  { href: "/dashboard", label: "My day", icon: Home },
  { href: "/tasks", label: "My tasks", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/family", label: "Family", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type AppNavProps = {
  variant: "sidebar" | "bottom";
  householdId?: string | null;
  conflictCount?: number;
  myDayMode?: boolean;
};

function ConflictBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  const label = count > 9 ? "9+" : String(count);
  return (
    <span
      className="bg-destructive text-destructive-foreground absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
      aria-label={`${count} sync conflict${count === 1 ? "" : "s"}`}
    >
      {label}
    </span>
  );
}

/**
 * Main nav. Conflict badge sits on Dashboard (one-tap path to review via dashboard card
 * and /conflicts). Near real-time count via Supabase realtime when householdId is set.
 */
export function AppNav({
  variant,
  householdId,
  conflictCount = 0,
  myDayMode = false,
}: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(conflictCount);
  const [, startTransition] = useTransition();
  const navItems = myDayMode ? myDayNav : coordinatorNav;

  useEffect(() => {
    setCount(conflictCount);
  }, [conflictCount]);

  useEffect(() => {
    if (!householdId || myDayMode) {
      return;
    }

    // Only one realtime subscriber per tree (sidebar is lg-only, bottom is mobile-only,
    // but both mount in the DOM). Use a distinct topic suffix per variant to avoid clashes.
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`nav-conflicts:${variant}:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sync_conflicts",
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            startTransition(() => router.refresh());
          },
        )
        .subscribe();
    } catch {
      // Realtime is best-effort.
    }

    return () => {
      if (!channel) {
        return;
      }
      try {
        const supabase = createClient();
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [householdId, router, variant, myDayMode]);

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Main navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const showConflict = !myDayMode && href === "/dashboard" && count > 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors sm:min-h-16 sm:gap-1 sm:px-2 sm:text-xs",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {showConflict ? <ConflictBadge count={count} /> : null}
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                  {active ? (
                    <span
                      className="absolute top-1.5 h-1 w-6 rounded-full bg-foreground sm:top-2 sm:w-8"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="hidden lg:block">
      <ul className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showConflict = !myDayMode && href === "/dashboard" && count > 0;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-sidebar-accent",
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-primary-foreground" : "text-sidebar-muted",
                    )}
                    aria-hidden="true"
                  />
                  {showConflict ? <ConflictBadge count={count} /> : null}
                </span>
                {label}
                {showConflict ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {!myDayMode && count > 0 ? (
          <li className="pt-1">
            <Link
              href="/conflicts"
              className="text-brand flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-sidebar-accent"
            >
              Resolve {count} conflict{count === 1 ? "" : "s"} →
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
