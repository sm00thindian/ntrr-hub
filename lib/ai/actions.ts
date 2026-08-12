"use server";

import { revalidatePath } from "next/cache";

import { runAgentsForHousehold } from "@/lib/ai/orchestrator";
import { requireHouseholdContext } from "@/lib/households/context";
import { canEditTasks } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export async function dismissAiInsight(insightId: string) {
  const ctx = await requireHouseholdContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("ai_insights")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", insightId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function snoozeAiInsight(insightId: string, hours: number) {
  const ctx = await requireHouseholdContext();
  const supabase = await createClient();

  const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("ai_insights")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", insightId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/** Re-run rule-based highlight agents for this household (no LLM). */
export async function refreshHouseholdHighlights() {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to refresh highlights." };
  }

  try {
    await runAgentsForHousehold(ctx.householdId, "daily");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh highlights.";
    return { error: message };
  }

  revalidatePath("/dashboard");
  return { success: true as const };
}