import { AppleCalDavConnectCard } from "@/components/integrations/apple-caldav-connect-card";
import { GoogleConnectCard } from "@/components/integrations/google-connect-card";
import { HouseholdTimezoneCard } from "@/components/settings/household-timezone-card";
import { requireHouseholdContext } from "@/lib/households/context";
import { isGoogleConfigured } from "@/lib/integrations/google/scopes";
import {
  getGoogleCalendarSettingsForUi,
  getHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { getHouseholdIntegration } from "@/lib/integrations/queries";
import { canManageIntegrations } from "@/lib/permissions/roles";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";

// Deferred Settings cards (do not show for dogfood):
// - Zapier/Make webhook — components/integrations/zapier-webhook-card.tsx + /api/webhooks/zapier
// - Microsoft Outlook — 1.1 (lib/sync/microsoft stub)

function feedbackFromSearchParams(params: { [key: string]: string | string[] | undefined }) {
  if (params.connected === "google") {
    return "Google connected. Initial sync started.";
  }

  const error = typeof params.error === "string" ? params.error : null;
  if (!error) {
    return null;
  }

  if (error === "permission") {
    return "Only owners and admins can connect Google.";
  }

  return decodeURIComponent(error);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await requireHouseholdContext();
  const canManage = canManageIntegrations(ctx.role);
  const params = await searchParams;
  const feedback = feedbackFromSearchParams(params);

  const [googleIntegration, appleIntegration, calendarSettings] = await Promise.all([
    canManage ? getHouseholdIntegration(ctx.householdId, "google") : null,
    canManage ? getHouseholdIntegration(ctx.householdId, "apple_caldav") : null,
    getHouseholdCalendarSettings(ctx.householdId),
  ]);

  let googleCalendarSettings: Awaited<ReturnType<typeof getGoogleCalendarSettingsForUi>> = null;
  if (canManage && googleIntegration?.status === "connected") {
    try {
      googleCalendarSettings = await getGoogleCalendarSettingsForUi(ctx.householdId);
    } catch {
      googleCalendarSettings = null;
    }
  }

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Integrations and account preferences
          {!canManage ? " · view only" : ""}
        </p>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can connect integrations. Ask your household admin for access.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <HouseholdTimezoneCard canManage={canManage} timezone={timeZone} />

        <GoogleConnectCard
          canManage={canManage}
          configured={isGoogleConfigured()}
          integration={googleIntegration}
          feedback={feedback}
          calendars={googleCalendarSettings?.calendars}
          selectedCalendarIds={googleCalendarSettings?.selectedCalendarIds}
          members={googleCalendarSettings?.members}
          memberColors={googleCalendarSettings?.memberColors}
          calendarAssignments={googleCalendarSettings?.calendarAssignments}
        />

        <AppleCalDavConnectCard canManage={canManage} integration={appleIntegration} />
      </div>
    </div>
  );
}