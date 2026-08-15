import { redirect } from "next/navigation";

import { TaskBoard } from "@/components/tasks/task-board";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import { getHouseholdMembers } from "@/lib/households/queries";
import {
  getZonedDayBounds,
  householdTimeZoneLabel,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { isMyDayPersona } from "@/lib/dashboard/my-day";
import { canCompleteOwnOrEditTasks, canEditTasks } from "@/lib/permissions/roles";
import { getHouseholdTasks, getRecurringTemplates, selectBoardTasks } from "@/lib/tasks/queries";
import type { RecurrenceCadence } from "@/lib/tasks/types";

export default async function TasksPage() {
  const ctx = await requireHouseholdContext();
  const canEdit = canEditTasks(ctx.role);
  /** Self-advocates can complete own assigned tasks even as viewers */
  const canComplete = canCompleteOwnOrEditTasks(ctx.role, ctx.persona);
  const myDayMode = isMyDayPersona(ctx.persona);

  const [rawTasks, templates, members, calendarSettings] = await Promise.all([
    getHouseholdTasks(ctx.householdId),
    getRecurringTemplates(ctx.householdId),
    getHouseholdMembers(ctx.householdId),
    getHouseholdCalendarSettings(ctx.householdId),
  ]);

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const dayBounds = getZonedDayBounds(timeZone);
  const cadenceByTemplateId: Record<string, RecurrenceCadence> = {};
  for (const template of templates) {
    cadenceByTemplateId[template.id] = template.cadence;
  }

  // Open work + done today only; done older than today hidden; cadence for chips
  const tasks = selectBoardTasks(rawTasks, {
    rangeStart: dayBounds.start,
    rangeEnd: dayBounds.end,
    cadenceByTemplateId,
  });

  if (!members.length) {
    redirect("/dashboard");
  }

  const timeZoneLabel = householdTimeZoneLabel(timeZone);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {myDayMode ? "My tasks" : "Tasks"}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {ctx.householdName}
          <span className="hidden sm:inline">
            {myDayMode ? " · assigned to you" : " · shared family task board"}
          </span>
          <span className="text-muted-foreground/80"> · {timeZoneLabel}</span>
        </p>
      </div>

      <TaskBoard
        householdId={ctx.householdId}
        currentUserId={ctx.userId}
        tasks={tasks}
        templates={templates}
        members={members}
        canEdit={canEdit}
        canComplete={canComplete}
        timeZone={timeZone}
        timeZoneLabel={timeZoneLabel}
        myDayMode={myDayMode}
      />
    </div>
  );
}