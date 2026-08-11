import Link from "next/link";

import { CalendarColorLegend } from "@/components/calendar/calendar-color-legend";
import { CalendarDefaultView } from "@/components/calendar/calendar-default-view";
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
  filterCalendarTasksForMember,
  filterEventsForMember,
  isMyDayPersona,
} from "@/lib/dashboard/my-day";
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

  // No explicit view → client picks day (phone) / 5-day (tablet) / week (desktop)
  if (!view) {
    return <CalendarDefaultView />;
  }

  const anchor = parseCalendarDate(params.date, params.week);
  const bounds = getCalendarBounds(view, anchor);

  const myDayMode = isMyDayPersona(ctx.persona);

  const [rawEvents, rawTasks, googleIntegration, appleIntegration, colorContext, calendarSettings] =
    await Promise.all([
      getCalendarEventsForRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getTasksDueInRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getHouseholdIntegration(ctx.householdId, "google"),
      getHouseholdIntegration(ctx.householdId, "apple_caldav"),
      buildCalendarColorContext(ctx.householdId),
      getHouseholdCalendarSettings(ctx.householdId),
    ]);

  const events = myDayMode
    ? filterEventsForMember(rawEvents, ctx.userId, calendarSettings.googleCalendars)
    : rawEvents;
  const tasks = myDayMode
    ? filterCalendarTasksForMember(rawTasks, ctx.userId)
    : rawTasks;

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  const dayParams = bounds.days.map((day) => toDayParam(day));
  const hasItems = events.length > 0 || tasks.length > 0;
  const googleConnected = googleIntegration?.status === "connected";
  const appleConnected = appleIntegration?.status === "connected";
  const hasIntegration = googleConnected || appleConnected;
  const canSync = canManageIntegrations(ctx.role) && googleConnected && !myDayMode;
  const emptyLabel = myDayMode
    ? view === "month"
      ? "Nothing on your calendar this month"
      : view === "1"
        ? "Nothing on your day"
        : "Nothing on your calendar in this range"
    : view === "month"
      ? "Nothing scheduled this month"
      : view === "1"
        ? "Nothing scheduled today"
        : view === "5"
          ? "No events or tasks this work week"
          : "No events or tasks this week";

  const monthMeta = view === "month" ? getMonthMeta(bounds.anchor) : null;
  const navLinks = getCalendarNavLinks(view, bounds.anchor);

  return (
    <div className="space-y-4 sm:space-y-6">
      {myDayMode ? (
        <p className="text-muted-foreground -mt-1 text-sm">
          Showing only your appointments and tasks
        </p>
      ) : null}

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
          {!myDayMode ? (
            <div className="hidden sm:block">
              <CalendarColorLegend context={colorContext} />
            </div>
          ) : null}
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
              view={view === "1" ? "1" : view === "5" ? "5" : "7"}
              days={dayParams}
              events={events}
              tasks={tasks}
              colorContext={colorContext}
              timeZone={timeZone}
            />
          )}
          {!myDayMode ? (
            <div className="sm:hidden">
              <CalendarColorLegend context={colorContext} />
            </div>
          ) : null}
        </>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{emptyLabel}</CardTitle>
            <CardDescription>
              {myDayMode
                ? "When a care calendar is linked to you, or tasks are assigned to you, they appear here."
                : hasIntegration
                  ? "Your calendars are connected. Run sync to pull the latest events and tasks from Google or Apple."
                  : "Connect Google Calendar or Apple CalDAV in Settings, then run sync to see your family schedule here."}
            </CardDescription>
          </CardHeader>
          {!myDayMode ? (
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canSync ? <CalendarSyncButton /> : null}
              <Button asChild variant={canSync ? "outline" : "default"} className="w-full sm:w-auto">
                <Link href="/settings">{hasIntegration ? "Settings" : "Connect calendars"}</Link>
              </Button>
            </CardContent>
          ) : (
            <CardContent>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard">Back to My day</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
