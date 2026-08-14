"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { syncGoogleNow } from "@/lib/integrations/actions";
import { createClient } from "@/lib/supabase/client";

type DashboardLiveRefreshProps = {
  householdId: string;
  /**
   * Caregiver Focus: periodic background Google sync while the tab is open.
   * My day: realtime + on-focus refresh only (no auto calendar sync).
   */
  enableCalendarSync?: boolean;
};

/** Debounce bursty realtime / multi-table updates into one soft refresh. */
const REFRESH_DEBOUNCE_MS = 900;

/** Soft SSR refresh while the board stays open (Hub data may lag without realtime). */
const SOFT_REFRESH_MS = 5 * 60 * 1000;

/** Quiet Google calendar pull while caregiver Focus is visible. */
const CALENDAR_SYNC_MS = 15 * 60 * 1000;

/** On tab focus, only auto-sync if last background sync was longer ago than this. */
const MIN_SYNC_ON_FOCUS_MS = 5 * 60 * 1000;

/**
 * Keeps the dashboard board fresh without noise:
 * - Realtime Hub task (+ calendar_events) changes → soft refresh
 * - Tab becomes visible again → refresh (+ optional sync if stale)
 * - Caregivers: periodic full-ish calendar sync every 15m while visible
 *
 * Renders nothing. Safe to mount once per dashboard view.
 */
export function DashboardLiveRefresh({
  householdId,
  enableCalendarSync = false,
}: DashboardLiveRefreshProps) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncAt = useRef(0);
  const syncInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      refreshTimer.current = setTimeout(() => {
        if (cancelled) return;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    async function runBackgroundSync() {
      if (!enableCalendarSync || cancelled || syncInFlight.current) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      syncInFlight.current = true;
      try {
        await syncGoogleNow();
        lastSyncAt.current = Date.now();
        if (!cancelled) {
          router.refresh();
        }
      } catch {
        // Best-effort; footer Sync now remains available
      } finally {
        syncInFlight.current = false;
      }
    }

    // —— Realtime: Hub tasks and calendar rows written by sync ——
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`dashboard-live:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `household_id=eq.${householdId}`,
          },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "calendar_events",
            filter: `household_id=eq.${householdId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe();
    } catch {
      // Realtime is best-effort (missing env, etc.)
    }

    // —— Tab focus: refresh; caregivers may soft-sync if stale ——
    function onVisibility() {
      if (document.visibilityState !== "visible") {
        return;
      }
      scheduleRefresh();
      if (
        enableCalendarSync &&
        Date.now() - lastSyncAt.current >= MIN_SYNC_ON_FOCUS_MS
      ) {
        void runBackgroundSync();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    // —— Soft refresh interval (both personas) ——
    const softRefreshId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      scheduleRefresh();
    }, SOFT_REFRESH_MS);

    // —— Calendar sync interval (caregivers only) ——
    let calendarSyncId: number | undefined;
    if (enableCalendarSync) {
      calendarSyncId = window.setInterval(() => {
        void runBackgroundSync();
      }, CALENDAR_SYNC_MS);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(softRefreshId);
      if (calendarSyncId !== undefined) {
        window.clearInterval(calendarSyncId);
      }
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
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
  }, [householdId, enableCalendarSync, router]);

  return null;
}
