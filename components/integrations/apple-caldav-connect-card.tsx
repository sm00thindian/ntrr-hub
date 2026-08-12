"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectAppleCalDav, disconnectAppleCalDav } from "@/lib/integrations/apple/actions";
import { saveAppleCalendarVisibility } from "@/lib/integrations/actions";
import type { CalendarVisibility } from "@/lib/calendar/colors";
import type { IntegrationAccount } from "@/lib/integrations/types";

type AppleCalDavConnectCardProps = {
  canManage: boolean;
  integration: IntegrationAccount | null;
  visibility?: CalendarVisibility;
};

export function AppleCalDavConnectCard({
  canManage,
  integration,
  visibility = "household",
}: AppleCalDavConnectCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [share, setShare] = useState<CalendarVisibility>(visibility);

  const connected = integration?.status === "connected";
  const calendarName = integration?.metadata.apple?.caldav?.calendarName;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apple (CalDAV)</CardTitle>
        <CardDescription>
          Connect <span className="font-medium text-foreground">your</span> iCloud calendar
          (app-specific password). Choose household share or personal-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">
          {connected ? `Connected${calendarName ? ` · ${calendarName}` : ""}` : "Not connected"}
        </p>

        {message ? (
          <p className="rounded-md bg-accent/60 px-3 py-2 text-sm" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canManage && connected ? (
          <div className="space-y-2">
            <Label htmlFor="apple-visibility">Visibility</Label>
            <select
              id="apple-visibility"
              className="border-input bg-background flex h-11 w-full rounded-md border px-3 text-sm"
              value={share}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.value as CalendarVisibility;
                setShare(next);
                setError(null);
                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("visibility", next);
                  const result = await saveAppleCalendarVisibility(formData);
                  if ("error" in result && result.error) {
                    setError(result.error);
                    return;
                  }
                  setMessage(
                    next === "personal"
                      ? "Apple calendar is personal — only you see those events."
                      : "Apple calendar is shared with the household.",
                  );
                });
              }}
            >
              <option value="household">Shared with household</option>
              <option value="personal">Personal (only me)</option>
            </select>
          </div>
        ) : null}

        {canManage && !connected ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);
              const formData = new FormData(event.currentTarget);
              formData.set("visibility", share);
              startTransition(async () => {
                const result = await connectAppleCalDav(formData);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setMessage("Apple calendar connected. Events are syncing.");
                event.currentTarget.reset();
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                name="visibility"
                className="border-input bg-background flex h-11 w-full rounded-md border px-3 text-sm"
                value={share}
                onChange={(event) => setShare(event.target.value as CalendarVisibility)}
              >
                <option value="household">Shared with household</option>
                <option value="personal">Personal (only me)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appleId">Apple ID</Label>
              <Input
                id="appleId"
                name="appleId"
                type="email"
                autoComplete="username"
                placeholder="you@icloud.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appPassword">App-specific password</Label>
              <Input
                id="appPassword"
                name="appPassword"
                type="password"
                autoComplete="current-password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                required
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Create one at{" "}
              <a
                href="https://appleid.apple.com/account/manage"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                appleid.apple.com
              </a>{" "}
              → Sign-In and Security → App-Specific Passwords.
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? "Connecting…" : "Connect Apple Calendar"}
            </Button>
          </form>
        ) : null}

        {canManage && connected ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await disconnectAppleCalDav();
                if (result.error) {
                  setError(result.error);
                }
              })
            }
          >
            Disconnect
          </Button>
        ) : null}

        {!canManage ? (
          <p className="text-sm text-muted-foreground">Connect unavailable for your role.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}