"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvite } from "@/lib/households/invite-actions";
import {
  ACCESS_FIELD_HELP,
  ASSIGNABLE_HOUSEHOLD_ROLES,
  HOUSEHOLD_PERSONAS,
  HOUSEHOLD_PERSONA_HINTS,
  HOUSEHOLD_PERSONA_LABELS,
  HOUSEHOLD_ROLE_HINTS,
  HOUSEHOLD_ROLE_LABELS,
  PERSONA_FIELD_HELP,
} from "@/lib/permissions/roles";

export function InviteForm() {
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [persona, setPersona] = useState<(typeof HOUSEHOLD_PERSONAS)[number]>("care_partner");
  const [role, setRole] = useState<(typeof ASSIGNABLE_HOUSEHOLD_ROLES)[number]>("member");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a family member</CardTitle>
        <CardDescription>
          Access = permissions in Hub. Care persona = their place in the care network. Hover the ?
          icons for details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          action={(formData) => {
            setError(null);
            setInviteUrl(null);
            startTransition(async () => {
              const result = await createInvite(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              if (result?.inviteUrl) {
                setInviteUrl(result.inviteUrl);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="family@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <FieldHelp label="Access" help={ACCESS_FIELD_HELP} htmlFor="role" />
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as (typeof ASSIGNABLE_HOUSEHOLD_ROLES)[number])
              }
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ASSIGNABLE_HOUSEHOLD_ROLES.map((r) => (
                <option key={r} value={r} title={HOUSEHOLD_ROLE_HINTS[r]}>
                  {HOUSEHOLD_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">{HOUSEHOLD_ROLE_HINTS[role]}</p>
          </div>
          <div className="space-y-2">
            <FieldHelp label="Care persona" help={PERSONA_FIELD_HELP} htmlFor="persona" />
            <select
              id="persona"
              name="persona"
              value={persona}
              onChange={(e) =>
                setPersona(e.target.value as (typeof HOUSEHOLD_PERSONAS)[number])
              }
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {HOUSEHOLD_PERSONAS.map((p) => (
                <option key={p} value={p} title={HOUSEHOLD_PERSONA_HINTS[p]}>
                  {HOUSEHOLD_PERSONA_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              {HOUSEHOLD_PERSONA_HINTS[persona]}
              {persona === "self_advocate"
                ? " Self-advocate invites are marked as a care focus person by default."
                : null}
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating invite…" : "Create invite link"}
          </Button>
        </form>

        {inviteUrl ? (
          <div className="mt-4 space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">Invite link ready</p>
            <p className="break-all text-sm text-muted-foreground">{inviteUrl}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
            >
              Copy link
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
