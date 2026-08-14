import { redirect } from "next/navigation";

import { AiHighlightsPanel } from "@/components/dashboard/ai-highlights-panel";
import { DashboardLiveRefresh } from "@/components/dashboard/dashboard-live-refresh";
import { MyDayPanel } from "@/components/dashboard/my-day-panel";
import { NeedsAttentionPanel } from "@/components/dashboard/needs-attention-panel";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { CreateHouseholdForm } from "@/components/household/create-household-form";
import { MembershipRefresh } from "@/components/household/membership-refresh";

import { getNeedsAttention } from "@/lib/dashboard/needs-attention-queries";
import { getMyDayAgenda, isMyDayPersona } from "@/lib/dashboard/my-day";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getUserMembership } from "@/lib/households/queries";
import { getHouseholdSetupStatus } from "@/lib/households/setup";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import {
  canCompleteOwnOrEditTasks,
  canManageIntegrations,
} from "@/lib/permissions/roles";
import { upsertProfile } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";

/** Always resolve membership + household data for the signed-in user. */
export const dynamic = "force-dynamic";

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

  // Retry once: session cookies can lag one tick after magic-link / OAuth callback.
  let membership = await getUserMembership(user.id);
  if (!membership) {
    await new Promise((r) => setTimeout(r, 150));
    membership = await getUserMembership(user.id);
  }

  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <MembershipRefresh />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Hub</h1>
          <p className="mt-2 text-muted-foreground">
            Create a household for your family coordination board — tasks, handoffs, and calendar
            context from the tools you already use. If you were invited, open the invite link from
            your email instead of creating a new household.
          </p>
        </div>
        <CreateHouseholdForm />
      </div>
    );
  }

  const calendarSettings = await getHouseholdCalendarSettings(membership.householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const canComplete = canCompleteOwnOrEditTasks(membership.role, membership.persona);
  const myDay = isMyDayPersona(membership.persona);

  // —— Self-advocate: My day only ——
  if (myDay) {
    const board = await getMyDayAgenda(membership.householdId, user.id, timeZone).catch(
      () => ({ today: [], tomorrow: [], tomorrowOverflow: 0 }),
    );

    return (
      <>
        <DashboardLiveRefresh householdId={membership.householdId} />
        <MyDayPanel
          items={board.today}
          tomorrow={board.tomorrow}
          tomorrowOverflow={board.tomorrowOverflow}
          timeZone={timeZone}
          canCompleteTasks={canComplete}
          householdName={membership.householdName}
        />
      </>
    );
  }

  // —— Coordinator / care partner / other: Focus = household day board ——
  // Shared calendars + Hub tasks in one card; sync lives in the app footer.
  const canSync = canManageIntegrations(membership.role);
  const [attention, setupStatus] = await Promise.all([
    getNeedsAttention(membership.householdId, timeZone, 6, user.id).catch(() => ({
      today: [],
      tomorrow: [],
      tomorrowOverflow: 0,
    })),
    getHouseholdSetupStatus(membership.householdId).catch(() => ({
      complete: true,
      steps: [],
      completedCount: 0,
      totalCount: 0,
    })),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardLiveRefresh
        householdId={membership.householdId}
        enableCalendarSync={canSync}
      />
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {membership.householdName} · today&apos;s board
        </p>
      </div>

      <SetupChecklist status={setupStatus} />

      {/*
        Caregiver / coordinator board:
        1. Focus (Today timeline + Tomorrow one-offs)
        2. Highlights
        Sync status → app footer (except /calendar)
      */}
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <NeedsAttentionPanel
          items={attention.today}
          tomorrow={attention.tomorrow}
          tomorrowOverflow={attention.tomorrowOverflow}
          timeZone={timeZone}
          canCompleteTasks={canComplete}
        />
        <AiHighlightsPanel
          householdId={membership.householdId}
          canRefresh={canComplete}
        />
      </div>
    </div>
  );
}
