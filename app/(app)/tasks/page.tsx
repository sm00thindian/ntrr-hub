import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { defaultMemberColors } from "@/lib/calendar/colors";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import { memberDisplayLabel } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import {
  getZonedDayBounds,
  householdTimeZoneLabel,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { isMyDayPersona } from "@/lib/dashboard/my-day";
import { canCompleteOwnOrEditTasks, canEditTasks } from "@/lib/permissions/roles";
import { getReliantBridgeState } from "@/lib/reliant/bridge";
import {
  buildTaskBoardSections,
  getHouseholdTasks,
  getRecurringTemplates,
} from "@/lib/tasks/queries";
import type { RecurrenceCadence } from "@/lib/tasks/types";

export default async function TasksPage() {
  const ctx = await requireHouseholdContext();
  const canEdit = canEditTasks(ctx.role);
  /** Self-advocates can complete own assigned tasks even as viewers */
  const canComplete = canCompleteOwnOrEditTasks(ctx.role, ctx.persona);
  const myDayMode = isMyDayPersona(ctx.persona);

  const [rawTasks, templates, members, calendarSettings, reliantBridge] = await Promise.all([
    getHouseholdTasks(ctx.householdId),
    getRecurringTemplates(ctx.householdId),
    getHouseholdMembers(ctx.householdId),
    getHouseholdCalendarSettings(ctx.householdId),
    getReliantBridgeState(ctx.householdId),
  ]);

  if (!members.length) {
    redirect("/dashboard");
  }

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const dayBounds = getZonedDayBounds(timeZone);
  const cadenceByTemplateId: Record<string, RecurrenceCadence> = {};
  for (const template of templates) {
    cadenceByTemplateId[template.id] = template.cadence;
  }

  const sections = buildTaskBoardSections(rawTasks, {
    rangeStart: dayBounds.start,
    rangeEnd: dayBounds.end,
    cadenceByTemplateId,
    todayKey: dayBounds.dayKey,
    timeZone,
  });

  const timeZoneLabel = householdTimeZoneLabel(timeZone);
  const memberColors = defaultMemberColors(
    members.map((member) => ({
      userId: member.userId,
      label: memberDisplayLabel(member.email, member.displayName),
    })),
    calendarSettings.memberColors,
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={myDayMode ? "My tasks" : "Tasks"}
        description={
          myDayMode
            ? "Your open work, done today, and history"
            : "Open work first, then done today and history"
        }
        meta={timeZoneLabel}
        hideDescriptionOnMobile
      />

      <TaskBoard
        householdId={ctx.householdId}
        currentUserId={ctx.userId}
        sections={sections}
        templates={templates}
        members={members}
        memberColors={memberColors}
        canEdit={canEdit}
        canComplete={canComplete}
        timeZone={timeZone}
        timeZoneLabel={timeZoneLabel}
        myDayMode={myDayMode}
        reliantBridge={reliantBridge}
      />
    </div>
  );
}
