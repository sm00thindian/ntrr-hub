"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HouseholdMember } from "@/lib/households/queries";
import { createRecurringTemplate } from "@/lib/tasks/actions";

type RecurringTemplateFormProps = {
  members: HouseholdMember[];
  onCreated?: () => void;
};

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function RecurringTemplateForm({ members, onCreated }: RecurringTemplateFormProps) {
  const [cadence, setCadence] = useState("weekly");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring template</CardTitle>
        <CardDescription>Creates a template and adds the first task instance now.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createRecurringTemplate(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              onCreated?.();
              event.currentTarget.reset();
              setCadence("weekly");
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="template-title">Title</Label>
            <Input id="template-title" name="title" placeholder="Refill weekly pill organizer" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cadence">Cadence</Label>
            <select
              id="cadence"
              name="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-assigneeId">Default assignee</Label>
            <select
              id="template-assigneeId"
              name="assigneeId"
              defaultValue=""
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
          {cadence === "weekly" ? (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of week</Label>
              <select
                id="dayOfWeek"
                name="dayOfWeek"
                defaultValue="1"
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {cadence === "monthly" ? (
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">Day of month</Label>
              <Input id="dayOfMonth" name="dayOfMonth" type="number" min={1} max={28} defaultValue={1} />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <input
                type="checkbox"
                name="reliantConfirmRequested"
                value="true"
                className="mt-0.5 size-4 shrink-0 rounded border-input"
              />
              <span>
                <span className="font-medium text-foreground">
                  Request Reliant phone confirmation
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                  Each instance of this series will request a phone confirm via Reliant when that
                  pipe is live (assignee or care focus / self-advocate).
                </span>
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Creating…" : "Create recurring task"}
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