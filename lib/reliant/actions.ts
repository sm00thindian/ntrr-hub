"use server";

import { revalidatePath } from "next/cache";

import { requireHouseholdContext } from "@/lib/households/context";
import { canManageIntegrations } from "@/lib/permissions/roles";
import { isReliantBridgeEnabled } from "@/lib/reliant/constants";
import { createClient } from "@/lib/supabase/server";

export async function connectHouseholdReliant() {
  if (!isReliantBridgeEnabled()) {
    return { error: "Reliant bridge is not enabled." };
  }

  const ctx = await requireHouseholdContext();
  if (!canManageIntegrations(ctx.role)) {
    return { error: "Only the household coordinator (owner or admin) can connect Reliant." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      reliant_connected_at: new Date().toISOString(),
      reliant_connected_by: ctx.userId,
    })
    .eq("id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function disconnectHouseholdReliant() {
  if (!isReliantBridgeEnabled()) {
    return { error: "Reliant bridge is not enabled." };
  }

  const ctx = await requireHouseholdContext();
  if (!canManageIntegrations(ctx.role)) {
    return { error: "Only the household coordinator (owner or admin) can disconnect Reliant." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      reliant_connected_at: null,
      reliant_connected_by: null,
    })
    .eq("id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true as const };
}
