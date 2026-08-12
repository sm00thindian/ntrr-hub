"use client";

import { useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleCalendarSettings } from "@/components/integrations/google-calendar-settings";
import { disconnectGoogle, syncGoogleNow } from "@/lib/integrations/actions";
import type { CalendarColorMember, GoogleCalendarAssignment } from "@/lib/calendar/colors";
import type { HouseholdCalendarInUse } from "@/lib/integrations/google/calendars";
import type { GoogleCalendarInfo, IntegrationAccount } from "@/lib/integrations/types";

type GoogleConnectCardProps = {
  canManage: boolean;
  configured: boolean;
  integration: IntegrationAccount | null;
  feedback?: string | null;
  calendars?: GoogleCalendarInfo[];
  selectedCalendarIds?: string[];
  members?: CalendarColorMember[];
  memberColors?: Record<string, string>;
  calendarAssignments?: Record<string, GoogleCalendarAssignment>;
  currentUserId: string;
  canEditMemberColors?: boolean;
  alreadyInHousehold?: Record<string, HouseholdCalendarInUse>;
};

function statusLabel(integration: IntegrationAccount | null) {
  if (!integration) {
    return "Not connected";
  }

  switch (integration.status) {
    case "connected":
      return "Connected";
    case "error":
      return "Error — reconnect recommended";
    case "pending":
      return "Pending";
    default:
      return "Disconnected";
  }
}

export function GoogleConnectCard({
  canManage,
  configured,
  integration,
  feedback,
  calendars = [],
  selectedCalendarIds = [],
  members = [],
  memberColors = {},
  calendarAssignments = {},
  currentUserId,
  canEditMemberColors = true,
  alreadyInHousehold = {},
}: GoogleConnectCardProps) {
  const [pending, startTransition] = useTransition();
  const connected = integration?.status === "connected";
  const email = integration?.metadata.tokens?.connectedEmail;
  const alreadyCount = Object.keys(alreadyInHousehold).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google</CardTitle>
        <CardDescription>
          Connect <span className="font-medium text-foreground">your</span> Google calendars. Mark
          each one shared with the household or personal. Shared calendars already connected by
          someone else are listed as already in the household — no need to add them again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">{statusLabel(integration)}</p>
          {email ? <p className="text-muted-foreground">{email}</p> : null}
          {!configured ? (
            <p className="text-muted-foreground">
              Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable connection.
            </p>
          ) : null}
          {connected && alreadyCount > 0 ? (
            <p className="text-muted-foreground text-xs">
              {alreadyCount} calendar{alreadyCount === 1 ? "" : "s"} on your Google account{" "}
              {alreadyCount === 1 ? "is" : "are"} already synced for this household by another
              member.
            </p>
          ) : null}
        </div>

        {feedback ? (
          <p className="text-sm text-muted-foreground" role="status">
            {feedback}
          </p>
        ) : null}

        {connected && calendars.length && members.length ? (
          <GoogleCalendarSettings
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            members={members}
            memberColors={memberColors}
            calendarAssignments={calendarAssignments}
            currentUserId={currentUserId}
            canEditMemberColors={canEditMemberColors}
            alreadyInHousehold={alreadyInHousehold}
          />
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {configured && !connected ? (
              <Button asChild>
                <Link href="/api/integrations/google/connect">Connect Google</Link>
              </Button>
            ) : null}

            {connected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startTransition(() => void syncGoogleNow())}
                >
                  {pending ? "Syncing…" : "Sync now"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => startTransition(() => void disconnectGoogle())}
                >
                  Disconnect
                </Button>
              </>
            ) : null}

            {configured && connected ? (
              <Button asChild variant="ghost">
                <Link href="/api/integrations/google/connect">Reconnect</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Connect unavailable for your role.</p>
        )}
      </CardContent>
    </Card>
  );
}