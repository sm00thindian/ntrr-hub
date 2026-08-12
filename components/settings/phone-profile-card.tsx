"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfileDisplayName,
  updateProfilePhone,
} from "@/lib/profiles/actions";
import { formatPhoneDisplay } from "@/lib/phone";

type PhoneProfileCardProps = {
  phoneE164: string | null;
  displayName: string | null;
};

export function PhoneProfileCard({ phoneE164, displayName }: PhoneProfileCardProps) {
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>
          Your name appears on assigned tasks for coordinators and care partners. Mobile is optional
          for Reliant phone confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-4"
          action={(formData) => {
            setError(null);
            setNameMessage(null);
            startTransition(async () => {
              const result = await updateProfileDisplayName(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              setNameMessage(`Saved as ${result.displayName}.`);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              placeholder="e.g. Jordan"
              defaultValue={displayName ?? ""}
              maxLength={80}
            />
            <p className="text-muted-foreground text-xs">
              Shown when someone assigns you a task — not your email.
            </p>
          </div>
          <Button type="submit" disabled={pending} variant="outline">
            {pending ? "Saving…" : "Save name"}
          </Button>
          {nameMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {nameMessage}
            </p>
          ) : null}
        </form>

        <form
          className="space-y-4 border-t pt-6"
          action={(formData) => {
            setError(null);
            setPhoneMessage(null);
            startTransition(async () => {
              const result = await updateProfilePhone(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              setPhoneMessage(
                result.phoneE164
                  ? `Saved ${formatPhoneDisplay(result.phoneE164)}.`
                  : "Mobile number cleared.",
              );
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              defaultValue={phoneE164 ?? ""}
            />
            <p className="text-muted-foreground text-xs">
              Optional. Coordinators: match your Reliant login phone. Call targets: the phone you
              answer for completion checks.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save mobile"}
          </Button>
          {phoneMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {phoneMessage}
            </p>
          ) : null}
        </form>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
