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
    getFamilyStatus(membership.householdId, user.id),
    getTodayAgenda(membership.householdId, timeZone),
    getNeedsAttention(membership.householdId, timeZone),
    getHouseholdSyncStatus(membership.householdId),
    getHouseholdSetupStatus(membership.householdId),
  ]);

  const canComplete = canEditTasks(membership.role);
  const canSync = canManageIntegrations(membership.role);

  return (
    <div className="space-y-6">
      <SetupChecklist status={setupStatus} />

      <div className="grid gap-4 lg:grid-cols-3">
        <NeedsAttentionPanel
          items={attention}
          timeZone={timeZone}
          canCompleteTasks={canComplete}
        />

        <FamilyStatusPanel status={familyStatus} />

        <SyncStatusPanel
          householdId={membership.householdId}
          status={syncStatus}
          canSync={canSync}
          timeZone={timeZone}
        />

        <DayAgenda items={agenda} timeZone={timeZone} />

        <AiHighlightsPanel householdId={membership.householdId} />
      </div>
    </div>
  );
}
