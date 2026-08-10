import Link from "next/link";
import { redirect } from "next/navigation";

import { AiHighlightsPanel } from "@/components/dashboard/ai-highlights-panel";
import { DayAgenda } from "@/components/dashboard/day-agenda";
import { FamilyStatusPanel } from "@/components/family/family-status-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateHouseholdForm } from "@/components/household/create-household-form";

import { getTodayAgenda } from "@/lib/dashboard/agenda";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getFamilyStatus, getUserMembership } from "@/lib/households/queries";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { upsertProfile } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email) {
    await upsertProfile(user);
  }

  const membership = await getUserMembership(user.id);

  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Hub</h1>
          <p className="mt-2 text-muted-foreground">
            Create a household to unlock your coordination dashboard.
          </p>
        </div>
        <CreateHouseholdForm />
      </div>
    );
  }

  const calendarSettings = await getHouseholdCalendarSettings(membership.householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  const [familyStatus, agenda, conflictCount] = await Promise.all([
    getFamilyStatus(membership.householdId, user.id),
    getTodayAgenda(membership.householdId, timeZone),
    getPendingConflictCount(membership.householdId),
  ]);

  // Priorities follow the same chronological order as the agenda
  const priorities = agenda.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s priorities</CardTitle>
            <CardDescription>Tasks and events that need attention now.</CardDescription>
          </CardHeader>
          <CardContent>
            {priorities.length ? (
              <ul className="relative space-y-0">
                {priorities.map((item, index) => (
                  <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < priorities.length - 1 ? (
                      <span
                        className="bg-brand absolute top-3 left-[5px] h-[calc(100%-4px)] w-0.5"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className="bg-brand relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.kind === "event" ? "Calendar event" : "Task"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing urgent today. Connect calendars in Settings to see priorities here.
              </p>
            )}
          </CardContent>
        </Card>

        <FamilyStatusPanel status={familyStatus} />

        <Card>
          <CardHeader>
            <CardTitle>Sync status</CardTitle>
            <CardDescription>Google Calendar + Tasks conflicts need your confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflictCount > 0 ? (
              <>
                <p className="text-sm">
                  <span className="text-brand text-2xl font-semibold">{conflictCount}</span>{" "}
                  <span className="text-muted-foreground">
                    pending conflict{conflictCount === 1 ? "" : "s"}
                  </span>
                </p>
                <Link href="/conflicts" className="text-brand text-sm font-medium hover:underline">
                  Review conflicts →
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sync conflicts. Connect calendars in Settings and run sync to keep everyone aligned.
              </p>
            )}
          </CardContent>
        </Card>

        <DayAgenda items={agenda} timeZone={timeZone} />

        <AiHighlightsPanel householdId={membership.householdId} />
      </div>
    </div>
  );
}