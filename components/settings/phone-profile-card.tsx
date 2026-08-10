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
        <CardTitle>Your mobile number</CardTitle>
        <CardDescription>
          Optional. If you are the household coordinator, use the same number as your Reliant
          account (billing). If you are a care partner or self-advocate, this is the number Reliant
          may call when a Hub task requests phone confirmation — you do not need your own Reliant
          subscription for that.
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
              Stored as E.164. Coordinators: match your Reliant login phone. Call targets: the phone
              you answer for completion checks.
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
