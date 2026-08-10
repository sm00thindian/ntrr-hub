"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { upsertProfile } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";

export type CreateHouseholdState = { error?: string } | null;

export async function createHousehold(
  _prevState: CreateHouseholdState,
  formData: FormData,
): Promise<CreateHouseholdState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Household name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You are not signed in. Please refresh and try again." };
  }

  if (user.email) {
    await upsertProfile(user);
  }

  const { data: householdId, error } = await supabase.rpc("create_household", {
    household_name: name,
  });

  if (error) {
    if (error.message.includes("Not authenticated")) {
      return {
        error:
          "Session expired. Sign out, sign in again, then create your household in the same browser.",
      };
    }
    return { error: error.message };
  }

  if (!householdId) {
    return { error: "Could not create household." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/family");
  redirect("/dashboard");
}

export async function updateHouseholdTimezone(timezone: string) {
  const { requireHouseholdContext } = await import("@/lib/households/context");
  const { canManageIntegrations } = await import("@/lib/permissions/roles");
  const {
    getHouseholdCalendarSettings,
    saveHouseholdCalendarSettings,
  } = await import("@/lib/households/calendar-settings");
  const { isValidTimeZone } = await import("@/lib/datetime/timezone");

  const ctx = await requireHouseholdContext();

  if (!canManageIntegrations(ctx.role)) {
    return { error: "Only owners and admins can change household timezone." };
  }

  if (!isValidTimeZone(timezone)) {
    return { error: "Choose a valid timezone." };
  }

  try {
    const current = await getHouseholdCalendarSettings(ctx.householdId);
    await saveHouseholdCalendarSettings(ctx.householdId, {
      ...current,
      timezone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save timezone.";
    return { error: message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true as const };
}