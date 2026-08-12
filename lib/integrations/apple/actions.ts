"use server";

import { revalidatePath } from "next/cache";

import { CALENDAR_COLOR_PALETTE } from "@/lib/calendar/colors";
import { appleCalendarKey, normalizeCalendarVisibility } from "@/lib/calendar/visibility";
import { encryptJson } from "@/lib/integrations/crypto";
import { verifyAppleCalDavConnection } from "@/lib/integrations/apple/caldav-client";
import {
  getHouseholdCalendarSettings,
  saveHouseholdCalendarSettings,
} from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import { canConnectCalendars } from "@/lib/permissions/roles";
import { pullAppleCalDavCalendar } from "@/lib/sync/apple/caldav";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { IntegrationMetadata } from "@/lib/integrations/types";

export async function connectAppleCalDav(formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canConnectCalendars(ctx.role, ctx.persona)) {
    return { error: "You do not have permission to manage calendar connections." };
  }

  const appleId = String(formData.get("appleId") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim().replace(/\s+/g, "");
  const visibility = normalizeCalendarVisibility(String(formData.get("visibility") ?? "household"));

  if (!appleId || !appPassword) {
    return { error: "Apple ID and app-specific password are required." };
  }

  try {
    const discovered = await verifyAppleCalDavConnection(appleId, appPassword);
    const admin = createAdminClient();

    const { data: account, error } = await admin
      .from("integration_accounts")
      .upsert(
        {
          household_id: ctx.householdId,
          provider: "apple_caldav",
          status: "connected",
          scopes: ["caldav-calendar"],
          metadata: {
            apple: {
              credentials: encryptJson({ appleId, appPassword }),
              caldav: {
                calendarUrl: discovered.calendarUrl,
                calendarName: discovered.calendarName,
              },
            },
          },
          created_by: ctx.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id,provider,created_by" },
      )
      .select(
        "id, household_id, provider, status, scopes, metadata, created_by, created_at, updated_at",
      )
      .single();

    if (error || !account) {
      return { error: error?.message ?? "Could not save Apple connection." };
    }

    // Default sharing for this Apple calendar
    const existing = await getHouseholdCalendarSettings(ctx.householdId);
    const key = appleCalendarKey(account.id as string);
    await saveHouseholdCalendarSettings(ctx.householdId, {
      ...existing,
      appleCalendars: {
        ...(existing.appleCalendars ?? {}),
        [key]: {
          memberUserId: ctx.userId,
          color: existing.appleCalendars?.[key]?.color ?? CALENDAR_COLOR_PALETTE[0]!,
          visibility,
        },
      },
    });

    await pullAppleCalDavCalendar({
      id: account.id as string,
      householdId: account.household_id as string,
      provider: "apple_caldav",
      status: account.status as "connected",
      scopes: account.scopes as string[] | null,
      metadata: account.metadata as IntegrationMetadata,
      createdBy: account.created_by as string,
      createdAt: account.created_at as string,
      updatedAt: account.updated_at as string,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect Apple CalDAV.";
    return { error: message };
  }
}

export async function disconnectAppleCalDav() {
  const ctx = await requireHouseholdContext();

  if (!canConnectCalendars(ctx.role, ctx.persona)) {
    return { error: "You do not have permission to manage calendar connections." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("integration_accounts")
    .update({
      status: "disconnected",
      metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq("household_id", ctx.householdId)
    .eq("provider", "apple_caldav")
    .eq("created_by", ctx.userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true };
}
