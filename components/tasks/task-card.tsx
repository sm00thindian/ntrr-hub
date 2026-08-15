"use client";

import { useState, useTransition } from "react";
import { Calendar, Pause, Pencil, Trash2, User } from "lucide-react";

import { AssigneeChip, ReliantConfirmChip } from "@/components/family/role-badge";
import { EditTaskForm } from "@/components/tasks/edit-task-form";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
import { Button } from "@/components/ui/button";
import {
  formatDateTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import type { HouseholdMember } from "@/lib/households/queries";
import { resolveAssigneeDisplay } from "@/lib/households/member-label";
import {
  deleteRecurringSeries,
  pauseTask,
  updateTaskStatus,
} from "@/lib/tasks/actions";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { RECURRENCE_CADENCE_LABELS, TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  canEdit: boolean;
  /** Done/reopen only (e.g. self-advocate viewer on own tasks). Defaults to canEdit. */
  canComplete?: boolean;
  compact?: boolean;
  timeZone?: string;
  timeZoneLabel?: string;
  members?: HouseholdMember[];
  onUpdated?: () => void;
};

type ConfirmMode = null | "pause" | "delete-series" | "delete-one";

function formatDue(dueAt: string | null, timeZone: string) {
  if (!dueAt) {
    return null;
  }
  return formatDateTimeInZone(dueAt, timeZone);
}

export function TaskCard({
  task,
  canEdit,
  canComplete,
  compact,
  timeZone,
  timeZoneLabel = "Household timezone",
  members = [],
  onUpdated,
}: TaskCardProps) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmMode>(null);
  const [editing, setEditing] = useState(false);
  const zone = resolveHouseholdTimeZone(timeZone);
  const dueLabel = formatDue(task.dueAt, zone);
  const assigneeFromMembers = resolveAssigneeDisplay(task.assigneeId, members);
  const assigneeLabel = task.assigneeLabel ?? assigneeFromMembers.label;
  const assigneePersona = task.assigneePersona ?? assigneeFromMembers.persona;
  const assigneeEmail = task.assigneeEmail ?? assigneeFromMembers.email;
  const allowComplete = canComplete ?? canEdit;
  const isRecurring = Boolean(task.recurringTemplateId);
  const cadenceLabel = task.recurrenceCadence
    ? RECURRENCE_CADENCE_LABELS[task.recurrenceCadence]
    : isRecurring
      ? "Recurring"
      : null;

  function runAction(action: () => Promise<{ error?: string; success?: boolean } | void>) {
    startTransition(async () => {
      await action();
      onUpdated?.();
    });
  }

  const isDone = task.status === "done";

  return (
    <>
      <article
        className={cn(
          "rounded-lg border bg-card p-3 shadow-sm",
          pending && "opacity-60",
          compact && "p-2.5",
          isDone && "border-brand/25 bg-brand/5",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3
              className={cn(
                "font-medium leading-snug",
                isDone && "text-muted-foreground line-through decoration-brand/40",
              )}
            >
              {task.title}
            </h3>
            {task.description ? (
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {task.reliantConfirmRequested && !isDone ? <ReliantConfirmChip /> : null}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                isDone
                  ? "bg-brand/15 text-brand"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <AssigneeChip
              label={assigneeLabel}
              persona={assigneePersona}
              email={assigneeEmail}
              unassigned={!task.assigneeId}
            />
          </span>
          {dueLabel ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {dueLabel}
            </span>
          ) : null}
          {cadenceLabel ? (
            <span
              className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              title="Recurring task"
            >
              {cadenceLabel}
            </span>
          ) : null}
        </div>

        {allowComplete || canEdit ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {allowComplete ? (
              <TaskDoneControl
                title={task.title}
                done={isDone}
                pending={pending}
                size="default"
                onMarkDone={() => runAction(() => updateTaskStatus(task.id, "done"))}
                onReopen={() => runAction(() => updateTaskStatus(task.id, "todo"))}
              />
            ) : null}
            {canEdit && task.status === "todo" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => runAction(() => updateTaskStatus(task.id, "in_progress"))}
              >
                Start
              </Button>
            ) : null}
            {canEdit && members.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}

            {canEdit && confirm === "pause" ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-2 sm:w-auto">
                <span className="text-xs font-medium">
                  Pause this occurrence? It leaves the board and won’t auto-return.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setConfirm(null);
                    runAction(() => pauseTask(task.id));
                  }}
                >
                  Pause
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {canEdit && confirm === "delete-series" && task.recurringTemplateId ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-2 sm:w-auto">
                <span className="text-destructive text-xs font-medium">
                  Delete the whole recurring series? Open cards stop; no future occurrences.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    const templateId = task.recurringTemplateId!;
                    setConfirm(null);
                    runAction(() => deleteRecurringSeries(templateId));
                  }}
                >
                  Delete series
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {canEdit && confirm === "delete-one" ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-2 sm:w-auto">
                <span className="text-destructive text-xs font-medium">Delete this task?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    setConfirm(null);
                    runAction(() => pauseTask(task.id));
                  }}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {canEdit && !confirm ? (
              <>
                {isRecurring ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setConfirm("pause")}
                      aria-label={`Pause ${task.title}`}
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setConfirm("delete-series")}
                      aria-label={`Delete series ${task.title}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete series
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirm("delete-one")}
                    aria-label={`Delete ${task.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </article>

      {editing && canEdit ? (
        <EditTaskForm
          task={task}
          members={members}
          timeZone={zone}
          timeZoneLabel={timeZoneLabel}
          onClose={() => setEditing(false)}
          onSaved={onUpdated}
        />
      ) : null}
    </>
  );
}

export function KanbanColumn({
  title,
  status,
  tasks,
  canEdit,
  canComplete,
  timeZone,
  timeZoneLabel,
  members,
  onUpdated,
}: {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  canEdit: boolean;
  canComplete?: boolean;
  timeZone?: string;
  timeZoneLabel?: string;
  members?: HouseholdMember[];
  onUpdated?: () => void;
}) {
  const columnTasks = tasks.filter((t) => t.status === status);

  return (
    <section className="flex min-h-48 flex-col rounded-xl border bg-muted/20 p-3">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
      </header>
      <ul className="space-y-2">
        {columnTasks.map((task) => (
          <li key={task.id}>
            <TaskCard
              task={task}
              canEdit={canEdit}
              canComplete={canComplete}
              timeZone={timeZone}
              timeZoneLabel={timeZoneLabel}
              members={members}
              onUpdated={onUpdated}
            />
          </li>
        ))}
        {!columnTasks.length ? (
          <li className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No tasks
          </li>
        ) : null}
      </ul>
    </section>
  );
}
