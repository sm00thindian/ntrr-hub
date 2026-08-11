import { redirect } from "next/navigation";

import { AiHighlightsPanel } from "@/components/dashboard/ai-highlights-panel";
import { DayAgenda } from "@/components/dashboard/day-agenda";
import { NeedsAttentionPanel } from "@/components/dashboard/needs-attention-panel";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { SyncStatusPanel } from "@/components/dashboard/sync-status-panel";
import { FamilyStatusPanel } from "@/components/family/family-status-panel";
import { CreateHouseholdForm } from "@/components/household/create-household-form";

import { getTodayAgenda } from "@/lib/dashboard/agenda";
import { getNeedsAttention } from "@/lib/dashboard/needs-attention-queries";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getFamilyStatus, getUserMembership } from "@/lib/households/queries";
import { getHouseholdSetupStatus } from "@/lib/households/setup";
import { getHouseholdSyncStatus } from "@/lib/integrations/status";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { canEditTasks, canManageIntegrations } from "@/lib/permissions/roles";
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
            Create a household for your family coordination board — tasks, handoffs, and calendar
            context from the tools you already use.
          </p>
        </div>
        <CreateHouseholdForm />
      </div>
    );
  }

  const calendarSettings = await getHouseholdCalendarSettings(membership.householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  const [familyStatus, agenda, attention, syncStatus, setupStatus] = await Promise.all([
    getFamilyStatus(membership.householdId, user.id).catch(() => ({
      memberCount: 0,
      pendingInviteCount: 0,
      members: [],
    })),
    getTodayAgenda(membership.householdId, timeZone).catch(() => []),
    getNeedsAttention(membership.householdId, timeZone).catch(() => []),
    getHouseholdSyncStatus(membership.householdId),
    getHouseholdSetupStatus(membership.householdId).catch(() => ({
      complete: true,
      steps: [],
      completedCount: 0,
      totalCount: 0,
    })),
  ]);

  const canComplete = canEditTasks(membership.role);
  const canSync = canManageIntegrations(membership.role);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {membership.householdName} · what needs you now
        </p>
      </div>

      <SetupChecklist status={setupStatus} />

      {/* Phone: single column. Tablet: 2-up. Desktop: 3-up with agenda spanning. */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-1">
          <NeedsAttentionPanel
            items={attention}
            timeZone={timeZone}
            canCompleteTasks={canComplete}
          />
        </div>

        <SyncStatusPanel
          householdId={membership.householdId}
          status={syncStatus}
          canSync={canSync}
          timeZone={timeZone}
        />

        <FamilyStatusPanel status={familyStatus} />

        <div className="md:col-span-2 lg:col-span-2">
          <DayAgenda items={agenda} timeZone={timeZone} />
        </div>

        <div className="md:col-span-2 lg:col-span-1">
          <AiHighlightsPanel householdId={membership.householdId} />
        </div>
      </div>
    </div>
  );
}
