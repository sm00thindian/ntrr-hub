import type { SyncEntityType } from "@/lib/sync/types";
import type { IntegrationAccount } from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

function asJson(value: unknown): Json {
  return value as Json;
}

export async function recordSyncConflict(params: {
  householdId: string;
  provider: IntegrationAccount["provider"];
  entityType: SyncEntityType;
  entityId: string;
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
}) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("sync_conflicts")
    .select("id")
    .eq("household_id", params.householdId)
    .eq("provider", params.provider)
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .eq("field_name", params.fieldName)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("sync_conflicts")
      .update({
        local_value: asJson(params.localValue),
        remote_value: asJson(params.remoteValue),
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await admin
    .from("sync_conflicts")
    .insert({
      household_id: params.householdId,
      provider: params.provider,
      entity_type: params.entityType,
      entity_id: params.entityId,
      field_name: params.fieldName,
      local_value: asJson(params.localValue),
      remote_value: asJson(params.remoteValue),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not record sync conflict.");
  }

  return data.id as string;
}

export async function getPendingConflictCount(householdId: string) {
  try {
    // Prefer user-scoped client (RLS allows members to view conflicts).
    // Fall back to admin if the request has no session cookies (cron paths).
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("sync_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "pending");

    if (!error) {
      return count ?? 0;
    }
  } catch {
    // fall through to admin
  }

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("sync_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "pending");

    if (error) {
      return 0;
    }

    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getPendingConflicts(householdId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sync_conflicts")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}