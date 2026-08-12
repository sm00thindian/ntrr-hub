import { AppleCalDavConnectCard } from "@/components/integrations/apple-caldav-connect-card";
import { GoogleConnectCard } from "@/components/integrations/google-connect-card";
import { HouseholdTimezoneCard } from "@/components/settings/household-timezone-card";
import { NtrrServicesCard } from "@/components/settings/ntrr-services-card";
import { PhoneProfileCard } from "@/components/settings/phone-profile-card";
import { isMyDayPersona } from "@/lib/dashboard/my-day";
import { requireHouseholdContext } from "@/lib/households/context";
import { isGoogleConfigured } from "@/lib/integrations/google/scopes";
import {
  getGoogleCalendarSettingsForUi,
  getHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { getHouseholdIntegration } from "@/lib/integrations/queries";
import { canManageIntegrations } from "@/lib/permissions/roles";
import { getProfileDisplayName, getProfilePhone } from "@/lib/profiles/actions";
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
  const myDayMode = isMyDayPersona(ctx.persona);
  const params = await searchParams;
  const feedback = feedbackFromSearchParams(params);

  const [googleIntegration, appleIntegration, calendarSettings, phoneE164, displayName] =
    await Promise.all([
      canManage ? getHouseholdIntegration(ctx.householdId, "google") : null,
      canManage ? getHouseholdIntegration(ctx.householdId, "apple_caldav") : null,
      getHouseholdCalendarSettings(ctx.householdId),
      getProfilePhone(ctx.userId),
      getProfileDisplayName(ctx.userId),
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
  const timezoneConfirmed = Boolean(calendarSettings.timezone?.trim());

  // Self-advocate: phone + quiet profile only (no integration admin)
  if (myDayMode) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Your phone and profile · household calendars are managed by a coordinator
          </p>
        </div>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <PhoneProfileCard phoneE164={phoneE164} displayName={displayName} />
          <HouseholdTimezoneCard
            canManage={false}
            timezone={timeZone}
            timezoneConfirmed={timezoneConfirmed}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Integrations and preferences
          {!canManage ? " · view only" : ""}
        </p>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can connect integrations. Ask your household admin for access.
        </p>
      ) : null}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <HouseholdTimezoneCard
          canManage={canManage}
          timezone={timeZone}
          timezoneConfirmed={timezoneConfirmed}
        />

        <PhoneProfileCard phoneE164={phoneE164} displayName={displayName} />

        <NtrrServicesCard />

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