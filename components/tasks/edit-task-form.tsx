"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { DueDateTimeField } from "@/components/tasks/due-datetime-field";
import { ReliantRequestFields } from "@/components/tasks/reliant-request-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import type { ReliantBridgeState } from "@/lib/reliant/constants";
import { updateTask } from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/types";

type EditTaskFormProps = {
  task: Task;
  members: HouseholdMember[];
  timeZone: string;
  timeZoneLabel: string;
  reliantBridge: ReliantBridgeState;
  onClose: () => void;
  onSaved?: () => void;
};

export function EditTaskForm({
  task,
  members,
  timeZone,
  timeZoneLabel,
  reliantBridge,
  onClose,
  onSaved,
}: EditTaskFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`edit-task-title-${task.id}`}
        className="bg-card max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={`edit-task-title-${task.id}`} className="text-lg font-semibold tracking-tight">
              Edit task
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Update details for your household board.</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          className="grid gap-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await updateTask(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              onSaved?.();
              onClose();
            });
          }}
        >
          <input type="hidden" name="taskId" value={task.id} />

          <div className="space-y-2">
            <Label htmlFor={`edit-title-${task.id}`}>Title</Label>
            <Input
              id={`edit-title-${task.id}`}
              name="title"
              defaultValue={task.title}
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-description-${task.id}`}>Notes (optional)</Label>
            <Input
              id={`edit-description-${task.id}`}
              name="description"
              defaultValue={task.description ?? ""}
              placeholder="Pharmacy closes at 6pm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-assignee-${task.id}`}>Assign to</Label>
            <select
              id={`edit-assignee-${task.id}`}
              name="assigneeId"
              defaultValue={task.assigneeId ?? ""}
              className="border-input flex h-11 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {memberDisplayLabel(member.email, member.displayName)}
                </option>
              ))}
            </select>
          </div>

          <DueDateTimeField
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            idPrefix={`edit-due-${task.id}`}
            defaultDueAt={task.dueAt}
          />

          <ReliantRequestFields
            bridge={reliantBridge}
            defaultConfirm={task.reliantConfirmRequested}
            defaultSms={task.reliantSmsReminderRequested}
            compact
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
