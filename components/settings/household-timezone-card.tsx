"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  /** Resolved display timezone (always a valid IANA zone). */
  timezone: string;
  /**
   * True when the household has explicitly saved a timezone.
   * When false, UI may still show a default — user must confirm once for setup.
   */
  timezoneConfirmed?: boolean;
};

export function HouseholdTimezoneCard({
  canManage,
  timezone,
  timezoneConfirmed = true,
}: HouseholdTimezoneCardProps) {
  const router = useRouter();
  const [value, setValue] = useState(resolveHouseholdTimeZone(timezone));
  const [confirmed, setConfirmed] = useState(timezoneConfirmed);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = value !== resolveHouseholdTimeZone(timezone);
  // Allow saving when unconfirmed even if the selection matches the displayed default.
  const canSave = canManage && (dirty || !confirmed) && !pending;

  return (
    <Card id="household-timezone">
      <CardHeader>
        <CardTitle>Household timezone</CardTitle>
        <CardDescription>
          Event and task times are shown in this zone for everyone in the household (not the
          server&rsquo;s clock).
          {!confirmed ? (
            <span className="text-foreground mt-1 block font-medium">
              Confirm this zone once so Hub can finish setup — even if it already looks correct.
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="household-timezone-select">Timezone</Label>
          <select
            id="household-timezone-select"
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
            disabled={!canSave}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await updateHouseholdTimezone(value);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setConfirmed(true);
                setMessage(
                  confirmed
                    ? "Timezone saved. Calendar times refresh on the next page load."
                    : "Timezone confirmed. Setup can continue on the dashboard.",
                );
                router.refresh();
              })
            }
          >
            {pending
              ? "Saving…"
              : !confirmed
                ? "Confirm timezone"
                : dirty
                  ? "Save timezone"
                  : "Saved"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can change timezone.</p>
        )}
      </CardContent>
    </Card>
  );
}
