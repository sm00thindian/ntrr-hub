"use client";

import { useState, useTransition } from "react";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/households/invite-actions";
import type { HouseholdPersona, HouseholdRole } from "@/lib/permissions/roles";

type AcceptInviteFormProps = {
  token: string;
  householdName: string;
  email: string;
  role: HouseholdRole;
  persona: HouseholdPersona;
  userEmail: string;
};

export function AcceptInviteForm({
  token,
  householdName,
  email,
  role,
  persona,
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
      </div>

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