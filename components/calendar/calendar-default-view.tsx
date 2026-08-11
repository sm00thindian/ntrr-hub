"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  buildCalendarHref,
  preferredDefaultView,
  type CalendarView,
} from "@/lib/calendar/views";

const STORAGE_KEY = "hub.calendar.view";

const VALID: CalendarView[] = ["1", "5", "7", "month"];

/**
 * When /calendar is opened without ?view=, pick a device-friendly default
 * (day on phone, work week on tablet, week on desktop) and remember last choice.
 */
export function CalendarDefaultView() {
  const router = useRouter();

  useEffect(() => {
    let view: CalendarView = preferredDefaultView(window.innerWidth);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && (VALID as string[]).includes(stored)) {
        view = stored as CalendarView;
      }
    } catch {
      // private mode — ignore
    }

    const href = buildCalendarHref(view, new Date());
    router.replace(href);
  }, [router]);

  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="bg-muted h-8 w-40 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-2xl" />
      <p className="text-muted-foreground text-sm">Loading calendar…</p>
    </div>
  );
}

export function rememberCalendarView(view: CalendarView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // ignore
  }
}
