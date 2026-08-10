"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvite } from "@/lib/households/invite-actions";
import {
  ASSIGNABLE_HOUSEHOLD_ROLES,
  HOUSEHOLD_PERSONAS,
  HOUSEHOLD_PERSONA_HINTS,
  HOUSEHOLD_PERSONA_LABELS,
  HOUSEHOLD_ROLE_LABELS,
} from "@/lib/permissions/roles";

export function InviteForm() {
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a family member</CardTitle>
        <CardDescription>
          Choose access (what they can do) and persona (their place in the care network). Self-advocates
          can later use a simpler My day view and Reliant phone confirmation.
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
            <Label htmlFor="role">Access</Label>
            <select
              id="role"
              name="role"
              defaultValue="member"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ASSIGNABLE_HOUSEHOLD_ROLES.map((role) => (
                <option key={role} value={role}>
                  {HOUSEHOLD_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Admin can manage members and integrations. Member can work the board. Viewer is read-mostly.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona">Care persona</Label>
            <select
              id="persona"
              name="persona"
              defaultValue="care_partner"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {HOUSEHOLD_PERSONAS.map((persona) => (
                <option key={persona} value={persona}>
                  {HOUSEHOLD_PERSONA_LABELS[persona]}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              {HOUSEHOLD_PERSONA_HINTS.care_partner} Self-advocate invites are marked as a care focus
              person by default.
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
