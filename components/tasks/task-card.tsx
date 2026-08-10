"use client";

import { useState, useTransition } from "react";
import { Calendar, Check, Pencil, Trash2, User } from "lucide-react";

import { ReliantConfirmChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import { EditTaskForm } from "@/components/tasks/edit-task-form";
import { Button } from "@/components/ui/button";
import {
  formatDateTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import type { HouseholdMember } from "@/lib/households/queries";
import { deleteTask, updateTaskStatus } from "@/lib/tasks/actions";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  canEdit: boolean;
  compact?: boolean;
  timeZone?: string;
  timeZoneLabel?: string;
  members?: HouseholdMember[];
  onUpdated?: () => void;
};

function formatDue(dueAt: string | null, timeZone: string) {
  if (!dueAt) {
    return null;
  }
  return formatDateTimeInZone(dueAt, timeZone);
}

export function TaskCard({
  task,
  canEdit,
  compact,
  timeZone,
  timeZoneLabel = "Household timezone",
  members = [],
  onUpdated,
}: TaskCardProps) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const zone = resolveHouseholdTimeZone(timeZone);
  const dueLabel = formatDue(task.dueAt, zone);

  function runAction(action: () => Promise<{ error?: string; success?: boolean } | void>) {
    startTransition(async () => {
      await action();
      onUpdated?.();
    });
  }

  return (
    <>
      <article
        className={cn(
          "rounded-lg border bg-card p-3 shadow-sm",
          pending && "opacity-60",
          compact && "p-2.5",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="font-medium leading-snug">{task.title}</h3>
            {task.description ? (
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <SourceChip source={task.provenance.source} />
            {task.reliantConfirmRequested ? <ReliantConfirmChip /> : null}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {task.assigneeEmail ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              {task.assigneeEmail}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
          {dueLabel ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {dueLabel}
            </span>
          ) : null}
          {task.recurringTemplateId ? <span>Recurring</span> : null}
        </div>

        {canEdit ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {task.status !== "done" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => runAction(() => updateTaskStatus(task.id, "done"))}
              >
                <Check className="h-4 w-4" />
                Done
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => runAction(() => updateTaskStatus(task.id, "todo"))}
              >
                Reopen
              </Button>
            )}
            {task.status === "todo" ? (
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
            {members.length ? (
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

            {confirmDelete ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-2 sm:w-auto">
                <span className="text-destructive text-xs font-medium">Delete this task?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    setConfirmDelete(false);
                    runAction(() => deleteTask(task.id));
                  }}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete ${task.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
  timeZone,
  timeZoneLabel,
  members,
  onUpdated,
}: {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  canEdit: boolean;
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
