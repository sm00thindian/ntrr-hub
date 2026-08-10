"use client";

import { useState, useTransition } from "react";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/households/invite-actions";
import type { HouseholdPersona, HouseholdRole } from "@/lib/permissions/roles";
import { formatPhoneDisplay } from "@/lib/phone";

type AcceptInviteFormProps = {
  token: string;
  householdName: string;
  email: string;
  role: HouseholdRole;
  persona: HouseholdPersona;
  phoneE164: string | null;
  userEmail: string;
};

export function AcceptInviteForm({
  token,
  householdName,
  email,
  role,
  persona,
  phoneE164,
  userEmail,
}: AcceptInviteFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailMatches = userEmail.toLowerCase() === email.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Household: <span className="font-medium text-foreground">{householdName}</span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          Invited as: <RoleBadge role={role} /> <PersonaBadge persona={persona} />
        </p>
        <p>
          Invite sent to: <span className="font-medium text-foreground">{email}</span>
        </p>
        {phoneE164 ? (
          <p>
            Mobile on invite:{" "}
            <span className="font-medium text-foreground">{formatPhoneDisplay(phoneE164)}</span>
          </p>
        ) : null}
      </div>

      {phoneE164 ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm leading-relaxed text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="note"
        >
          <p className="font-medium">About this mobile number</p>
          <p className="mt-1.5 text-xs leading-relaxed opacity-90 sm:text-sm">
            Your household included <strong>{formatPhoneDisplay(phoneE164)}</strong> so Hub can
            correlate you with{" "}
            <a
              href="https://reliant.ntrr.com"
              className="font-medium underline underline-offset-2"
              rel="noopener noreferrer"
            >
              Reliant
            </a>
            , NTRR&apos;s phone-first reliability service. When a task or event requests{" "}
            <strong>Reliant phone confirmation</strong>, Reliant may call this number until you
            confirm. That is optional, tiered accountability — not required for basic Hub use. You can
            change or remove the number in Settings after you join.
          </p>
        </div>
      ) : null}

      {!emailMatches ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          You are signed in as {userEmail}. Sign in with {email} to accept this invite.
        </p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acceptInvite(token);
              if (result?.error) {
                setError(result.error);
              }
            });
          }}
        >
          {pending ? "Joining…" : "Join household"}
        </Button>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
