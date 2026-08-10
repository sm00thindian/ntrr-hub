"use client";

import { useState, useTransition } from "react";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revokeInvite } from "@/lib/households/invite-actions";
import { buildInviteShareText } from "@/lib/households/invite-message";
import type { PendingInvite } from "@/lib/households/queries";
import { formatPhoneDisplay } from "@/lib/phone";

type PendingInvitesProps = {
  invites: PendingInvite[];
  canManage: boolean;
  householdName: string;
};

function formatExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PendingInvites({ invites, canManage, householdName }: PendingInvitesProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (!invites.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invites ({invites.length})</CardTitle>
        <CardDescription>Invites waiting to be accepted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {invites.map((invite) => {
            const url = `${siteUrl}/invite/${invite.token}`;
            const shareText = buildInviteShareText({
              householdName,
              inviteUrl: url,
              phoneE164: invite.phoneE164,
            });

            return (
              <li
                key={invite.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{invite.email}</p>
                  {invite.phoneE164 ? (
                    <p className="text-muted-foreground text-sm">
                      Mobile {formatPhoneDisplay(invite.phoneE164)} · Reliant note included
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Expires {formatExpiry(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={invite.role} />
                  <PersonaBadge persona={invite.persona} />
                  {canManage ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(url)}
                      >
                        Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(shareText)}
                      >
                        Copy message
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await revokeInvite(invite.id);
                            if (result?.error) {
                              setError(result.error);
                            }
                          });
                        }}
                      >
                        Revoke
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
