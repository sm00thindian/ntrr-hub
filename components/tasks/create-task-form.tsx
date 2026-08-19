"use client";

import { useState, useTransition } from "react";

import { DueDateTimeField } from "@/components/tasks/due-datetime-field";
import { ReliantRequestFields } from "@/components/tasks/reliant-request-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import type { ReliantBridgeState } from "@/lib/reliant/constants";
import { createTask } from "@/lib/tasks/actions";

type CreateTaskFormProps = {
  members: HouseholdMember[];
  timeZone: string;
  timeZoneLabel: string;
  /** Pre-select assignee (e.g. self for My day mode) */
  defaultAssigneeId?: string;
  reliantBridge: ReliantBridgeState;
  onCreated?: () => void;
};

export function CreateTaskForm({
  members,
  timeZone,
  timeZoneLabel,
  defaultAssigneeId = "",
  reliantBridge,
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
                  {memberDisplayLabel(member.email, member.displayName)}
                </option>
              ))}
            </select>
          </div>

          <DueDateTimeField timeZone={timeZone} timeZoneLabel={timeZoneLabel} />

          <ReliantRequestFields bridge={reliantBridge} />

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
