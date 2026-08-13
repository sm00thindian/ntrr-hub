import Link from "next/link";

import { CalendarColorLegend } from "@/components/calendar/calendar-color-legend";
import { CalendarDefaultView } from "@/components/calendar/calendar-default-view";
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
import { filterCalendarTasksForMember, isMyDayPersona } from "@/lib/dashboard/my-day";
import { filterEventsForViewer } from "@/lib/calendar/visibility";
import {
  buildCalendarColorContext,
  getHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import {
  getAllConnectedAppleIntegrationsAdmin,
  getAllConnectedGoogleIntegrationsAdmin,
  getMemberIntegration,
} from "@/lib/integrations/queries";
import { canConnectCalendars, canManageIntegrations } from "@/lib/permissions/roles";
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
  const canConnect = canConnectCalendars(ctx.role, ctx.persona);

  const [rawEvents, rawTasks, googleAccounts, appleAccounts, memberGoogle, colorContext, calendarSettings] =
    await Promise.all([
      getCalendarEventsForRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getTasksDueInRange(ctx.householdId, bounds.rangeStart, bounds.rangeEnd),
      getAllConnectedGoogleIntegrationsAdmin(ctx.householdId),
      getAllConnectedAppleIntegrationsAdmin(ctx.householdId),
      getMemberIntegration(ctx.householdId, "google", ctx.userId),
      buildCalendarColorContext(ctx.householdId),
      getHouseholdCalendarSettings(ctx.householdId),
    ]);

  // Household shared + this member's personal calendars only (ADR 0002)
  const events = filterEventsForViewer(rawEvents, ctx.userId, calendarSettings);
  const tasks = myDayMode
    ? filterCalendarTasksForMember(rawTasks, ctx.userId)
    : rawTasks;

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  const dayParams = bounds.days.map((day) => toDayParam(day));
  const hasItems = events.length > 0 || tasks.length > 0;
  const googleConnected = googleAccounts.length > 0;
  const appleConnected = appleAccounts.length > 0;
  const hasIntegration = googleConnected || appleConnected;
  const canSync =
    canConnect &&
    (memberGoogle?.status === "connected" ||
      canManageIntegrations(ctx.role)) &&
    googleConnected;
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
      <p className="text-muted-foreground -mt-1 text-sm">
        {myDayMode
          ? "Shared family calendars plus your personal calendars and tasks"
          : "Shared household calendars plus your personal calendars — private calendars of others stay private"}
      </p>

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
                ? "Shared family calendars and your personal calendars or assigned tasks appear here. Connect calendars in Settings if needed."
                : hasIntegration
                  ? "Calendars are connected for the household. Run sync to pull the latest Google or Apple events."
                  : "Connect your Google or Apple calendar in Settings (shared with household or personal)."}
            </CardDescription>
          </CardHeader>
          {!myDayMode ? (
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild variant="default" className="w-full sm:w-auto">
                <Link href="/settings">{hasIntegration ? "Settings" : "Connect calendars"}</Link>
              </Button>
              {hasIntegration ? (
                <p className="text-muted-foreground text-xs sm:self-center">
                  Use <span className="font-medium text-foreground">Sync now</span> in the footer to
                  refresh events.
                </p>
              ) : null}
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
