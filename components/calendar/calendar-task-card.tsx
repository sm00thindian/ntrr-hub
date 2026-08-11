import Link from "next/link";
import { ListTodo } from "lucide-react";

import { AssigneeChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import type { CalendarTask } from "@/lib/calendar/types";
import {
  formatTimeInZone,
  isMidnightInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { TASK_STATUS_LABELS } from "@/lib/tasks/types";

export function CalendarTaskCard({
  task,
  timeZone,
  showAssignee = true,
}: {
  task: CalendarTask;
  timeZone?: string;
  /** Coordinators/care partners: show who the task is for */
  showAssignee?: boolean;
}) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const hasTime = !isMidnightInZone(task.dueAt, zone);

  return (
    <Link
      href="/tasks"
      className="block rounded-xl border border-dashed border-brand/40 bg-brand/5 px-3 py-2.5 transition-colors hover:bg-brand/10"
    >
      <div className="flex items-start gap-2">
        <ListTodo className="text-brand mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</p>
            <SourceChip source={task.provenance.source} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Task · {TASK_STATUS_LABELS[task.status]}
            {hasTime ? ` · Due ${formatTimeInZone(task.dueAt, zone)}` : ""}
          </p>
          {showAssignee ? (
            <div className="mt-1.5">
              <AssigneeChip
                label={task.assigneeLabel}
                persona={task.assigneePersona}
                unassigned={!task.assigneeId}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}