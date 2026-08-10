import Link from "next/link";

import { CalendarColorLegend } from "@/components/calendar/calendar-color-legend";
import { CalendarSyncButton } from "@/components/calendar/calendar-sync-button";
import { CalendarViewNav } from "@/components/calendar/calendar-view-nav";
import { DayGridCalendar } from "@/components/calendar/day-grid-calendar";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalendarEventsForRange, getTasksDueInRange } from "@/lib/calendar/queries";
import {
  getCalendarBounds,
  getCalendarNavLinks,
  getMonthMeta,
  parseCalendarDate,
  parseCalendarView,
} from "@/lib/calendar/views";
import { toDayParam } from "@/lib/calendar/week";
import {
  buildCalendarColorContext,
  getHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import { getHouseholdIntegration } from "@/lib/integrations/queries";
import { canManageIntegrations } from "@/lib/permissions/roles";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";

type CalendarPageProps = {
  searchParams: Promise<{ view?: string; date?: string; week?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const ctx = await requireHouseholdContext();
  const params = await searchParams;
  const view = parseCalendarView(params.view);
  const anchor = parseCalendarDate(params.date, params.week);
  const bounds = getCalendarBounds(view, anchor);

  const [events, tasks, googleIntegration, appleIntegration, colorContext, calendarSettings] =
    await Promise.all([
      getCalendarEventsForRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getTasksDueInRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getHouseholdIntegration(ctx.householdId, "google"),
      getHouseholdIntegration(ctx.householdId, "apple_caldav"),
      buildCalendarColorContext(ctx.householdId),
      getHouseholdCalendarSettings(ctx.householdId),
    ]);

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  const dayParams = bounds.days.map((day) => toDayParam(day));
  const hasItems = events.length > 0 || tasks.length > 0;
  const googleConnected = googleIntegration?.status === "connected";
  const appleConnected = appleIntegration?.status === "connected";
  const hasIntegration = googleConnected || appleConnected;
  const canSync = canManageIntegrations(ctx.role) && googleConnected;
  const emptyLabel =
    view === "month"
      ? "Nothing scheduled this month"
      : view === "5"
        ? "No events or tasks this work week"
        : "No events or tasks this week";

  const monthMeta = view === "month" ? getMonthMeta(bounds.anchor) : null;
  const navLinks = getCalendarNavLinks(view, bounds.anchor);

  return (
    <div className="space-y-6">
      <CalendarViewNav
        view={view}
        periodLabel={bounds.periodLabel}
        prevHref={navLinks.prevHref}
        nextHref={navLinks.nextHref}
        todayHref={navLinks.todayHref}
        viewHrefs={navLinks.viewHrefs}
      />

      {hasItems ? (
        <>
          <CalendarColorLegend context={colorContext} />
          {view === "month" && monthMeta ? (
            <MonthCalendar
              days={dayParams}
              events={events}
              tasks={tasks}
              month={monthMeta.month}
              year={monthMeta.year}
              colorContext={colorContext}
              timeZone={timeZone}
            />
          ) : (
            <DayGridCalendar
              view={view === "5" ? "5" : "7"}
              days={dayParams}
              events={events}
              tasks={tasks}
              colorContext={colorContext}
              timeZone={timeZone}
            />
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{emptyLabel}</CardTitle>
            <CardDescription>
              {hasIntegration
                ? "Your calendars are connected. Run sync to pull the latest events and tasks from Google or Apple."
                : "Connect Google Calendar or Apple CalDAV in Settings, then run sync to see your family schedule here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canSync ? <CalendarSyncButton /> : null}
            <Button asChild variant={canSync ? "outline" : "default"}>
              <Link href="/settings">{hasIntegration ? "Settings" : "Connect calendars"}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}