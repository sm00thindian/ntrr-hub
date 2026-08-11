"use client";

import { useState, useTransition } from "react";

import { DueDateTimeField } from "@/components/tasks/due-datetime-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HouseholdMember } from "@/lib/households/queries";
import { createTask } from "@/lib/tasks/actions";

type CreateTaskFormProps = {
  members: HouseholdMember[];
  timeZone: string;
  timeZoneLabel: string;
  /** Pre-select assignee (e.g. self for My day mode) */
  defaultAssigneeId?: string;
  onCreated?: () => void;
};

export function CreateTaskForm({
  members,
  timeZone,
  timeZoneLabel,
  defaultAssigneeId = "",
  onCreated,
}: CreateTaskFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add task</CardTitle>
        <CardDescription>
          Create a family task with optional assignee and due date. Due times use household timezone (
          {timeZoneLabel}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={formKey}
          className="grid gap-4 sm:grid-cols-2"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createTask(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              onCreated?.();
              setFormKey((k) => k + 1);
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Pick up prescription" required maxLength={120} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Input id="description" name="description" placeholder="Pharmacy closes at 6pm" />
          </div>
          <div className="space-y-2 sm:col-span-2 sm:max-w-md">
            <Label htmlFor="assigneeId">Assign to</Label>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue={defaultAssigneeId}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName ?? member.email}
                </option>
              ))}
            </select>
          </div>

          <DueDateTimeField timeZone={timeZone} timeZoneLabel={timeZoneLabel} />

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <input
                type="checkbox"
                name="reliantConfirmRequested"
                value="true"
                className="mt-0.5 size-4 shrink-0 rounded border-input"
              />
              <span>
                <span className="font-medium text-foreground">Request Reliant phone confirmation</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                  Uses the household coordinator&apos;s Reliant account (billing). Reliant calls the
                  assignee or self-advocate&apos;s mobile until they confirm completion — they do not
                  need their own Reliant subscription.
                </span>
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add task"}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
