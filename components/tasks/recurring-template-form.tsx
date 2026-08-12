"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import { createRecurringTemplate } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

type RecurringTemplateFormProps = {
  members: HouseholdMember[];
  timeZoneLabel: string;
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

const TIME_PRESETS = [
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "5:00 PM", value: "17:00" },
  { label: "8:00 PM", value: "20:00" },
] as const;

export function RecurringTemplateForm({
  members,
  timeZoneLabel,
  onCreated,
}: RecurringTemplateFormProps) {
  const [cadence, setCadence] = useState("weekly");
  const [dueTime, setDueTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring template</CardTitle>
        <CardDescription>
          Creates a template and adds the first task instance now. Times use {timeZoneLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={formKey}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const form = event.currentTarget;
            const formData = new FormData(form);
            startTransition(async () => {
              try {
                const result = await createRecurringTemplate(formData);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                onCreated?.();
                setCadence("weekly");
                setDueTime("09:00");
                setFormKey((k) => k + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create recurring task.");
              }
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="template-title">Title</Label>
            <Input
              id="template-title"
              name="title"
              placeholder="Refill weekly pill organizer"
              required
            />
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
                  {memberDisplayLabel(member.email, member.displayName)}
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
              <Input
                id="dayOfMonth"
                name="dayOfMonth"
                type="number"
                min={1}
                max={28}
                defaultValue={1}
              />
            </div>
          ) : null}

          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Label htmlFor="template-due-time" className="text-sm font-medium">
                Time (optional)
              </Label>
              <p className="text-muted-foreground text-xs">{timeZoneLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDueTime(preset.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dueTime === preset.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDueTime("")}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !dueTime
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                No time
              </button>
            </div>
            <Input
              id="template-due-time"
              name="dueTime"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="max-w-xs [color-scheme:light]"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {dueTime
                ? `Each instance is due at ${formatTimeLabel(dueTime)} on the scheduled day.`
                : "No due time — instances appear without a clock time until you edit them."}
            </p>
          </div>

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
                  Each instance uses the coordinator&apos;s Reliant account. Reliant calls the
                  assignee or care focus (self-advocate) mobile until they confirm — call target ≠
                  account holder.
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

function formatTimeLabel(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return hhmm;
  }
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
