"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { updateHouseholdTimezone } from "@/lib/households/actions";
import {
  HOUSEHOLD_TIMEZONE_OPTIONS,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";

type HouseholdTimezoneCardProps = {
  canManage: boolean;
  timezone: string;
};

export function HouseholdTimezoneCard({ canManage, timezone }: HouseholdTimezoneCardProps) {
  const [value, setValue] = useState(resolveHouseholdTimeZone(timezone));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = value !== resolveHouseholdTimeZone(timezone);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household timezone</CardTitle>
        <CardDescription>
          Event and task times are shown in this zone for everyone in the household (not the
          server&rsquo;s clock).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="household-timezone">Timezone</Label>
          <select
            id="household-timezone"
            className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={value}
            disabled={!canManage || pending}
            onChange={(event) => {
              setValue(event.target.value);
              setMessage(null);
              setError(null);
            }}
          >
            {HOUSEHOLD_TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canManage ? (
          <Button
            type="button"
            disabled={!dirty || pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await updateHouseholdTimezone(value);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setMessage("Timezone saved. Calendar times refresh on the next page load.");
              })
            }
          >
            {pending ? "Saving…" : "Save timezone"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can change timezone.</p>
        )}
      </CardContent>
    </Card>
  );
}
