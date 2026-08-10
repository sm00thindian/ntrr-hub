"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfilePhone } from "@/lib/profiles/actions";
import { formatPhoneDisplay } from "@/lib/phone";

type PhoneProfileCardProps = {
  phoneE164: string | null;
};

export function PhoneProfileCard({ phoneE164 }: PhoneProfileCardProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mobile for Reliant</CardTitle>
        <CardDescription>
          Optional. Reliant is phone-first — saving your mobile here lets Hub correlate you with a
          Reliant account for phone confirmations and the Hub + Reliant bundle later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          action={(formData) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await updateProfilePhone(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              setMessage(
                result.phoneE164
                  ? `Saved ${formatPhoneDisplay(result.phoneE164)}. Use this number in Reliant to link services.`
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
              Stored as E.164. Same number you answer for Reliant calls.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save mobile"}
          </Button>
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
        </form>
      </CardContent>
    </Card>
  );
}
