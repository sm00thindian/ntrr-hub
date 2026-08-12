import { AppleCalDavConnectCard } from "@/components/integrations/apple-caldav-connect-card";
import { GoogleConnectCard } from "@/components/integrations/google-connect-card";
import { HouseholdTimezoneCard } from "@/components/settings/household-timezone-card";
import { NtrrServicesCard } from "@/components/settings/ntrr-services-card";
import { PhoneProfileCard } from "@/components/settings/phone-profile-card";
import { isMyDayPersona } from "@/lib/dashboard/my-day";
import { appleCalendarKey, normalizeCalendarVisibility } from "@/lib/calendar/visibility";
import { requireHouseholdContext } from "@/lib/households/context";
import { isGoogleConfigured } from "@/lib/integrations/google/scopes";
import {
  getGoogleCalendarSettingsForUi,
  getHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { getMemberIntegration } from "@/lib/integrations/queries";
import {
  canConnectCalendars,
  canManageIntegrations,
} from "@/lib/permissions/roles";
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
    return "You do not have permission to connect calendars.";
  }

  return decodeURIComponent(error);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await requireHouseholdContext();
  const canManageHousehold = canManageIntegrations(ctx.role);
  const canConnect = canConnectCalendars(ctx.role, ctx.persona);
  const myDayMode = isMyDayPersona(ctx.persona);
  const params = await searchParams;
  const feedback = feedbackFromSearchParams(params);

  const [googleIntegration, appleIntegration, calendarSettings, phoneE164, displayName] =
    await Promise.all([
      canConnect ? getMemberIntegration(ctx.householdId, "google", ctx.userId) : null,
      canConnect ? getMemberIntegration(ctx.householdId, "apple_caldav", ctx.userId) : null,
      getHouseholdCalendarSettings(ctx.householdId),
      getProfilePhone(ctx.userId),
      getProfileDisplayName(ctx.userId),
    ]);

  let googleCalendarSettings: Awaited<ReturnType<typeof getGoogleCalendarSettingsForUi>> = null;
  if (canConnect && googleIntegration?.status === "connected") {
    try {
      googleCalendarSettings = await getGoogleCalendarSettingsForUi(
        ctx.householdId,
        ctx.userId,
      );
    } catch {
      googleCalendarSettings = null;
    }
  }

  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const timezoneConfirmed = Boolean(calendarSettings.timezone?.trim());
  const appleKey = appleIntegration ? appleCalendarKey(appleIntegration.id) : null;
  const appleVisibility = appleKey
    ? normalizeCalendarVisibility(calendarSettings.appleCalendars?.[appleKey]?.visibility)
    : "household";

  const integrationsBlock = canConnect ? (
    <>
      <GoogleConnectCard
        canManage={canConnect}
        configured={isGoogleConfigured()}
        integration={googleIntegration}
        feedback={feedback}
        calendars={googleCalendarSettings?.calendars}
        selectedCalendarIds={googleCalendarSettings?.selectedCalendarIds}
        members={googleCalendarSettings?.members}
        memberColors={googleCalendarSettings?.memberColors}
        calendarAssignments={googleCalendarSettings?.calendarAssignments}
        currentUserId={ctx.userId}
        canEditMemberColors={canManageHousehold}
      />

      <AppleCalDavConnectCard
        canManage={canConnect}
        integration={appleIntegration}
        visibility={appleVisibility}
      />
    </>
  ) : null;

  // Self-advocate: profile + optional own calendars
  if (myDayMode) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Your phone, profile, and optional calendars (shared with family or personal only)
          </p>
        </div>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <PhoneProfileCard phoneE164={phoneE164} displayName={displayName} />
          <HouseholdTimezoneCard
            canManage={false}
            timezone={timeZone}
            timezoneConfirmed={timezoneConfirmed}
          />
          {integrationsBlock}
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
          {!canConnect ? " · calendar connect unavailable for viewers" : ""}
        </p>
      </div>

      {!canConnect ? (
        <p className="text-sm text-muted-foreground">
          Your access role cannot connect calendars. Ask a coordinator if you need to share a
          schedule.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Connect <span className="text-foreground font-medium">your</span> Google or Apple
          calendars. Mark each one <span className="text-foreground font-medium">shared with
          household</span> or <span className="text-foreground font-medium">personal</span> (only
          you, or the selected family member).
        </p>
      )}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <HouseholdTimezoneCard
          canManage={canManageHousehold}
          timezone={timeZone}
          timezoneConfirmed={timezoneConfirmed}
        />

        <PhoneProfileCard phoneE164={phoneE164} displayName={displayName} />

        <NtrrServicesCard />

        {integrationsBlock}
      </div>
    </div>
  );
}
