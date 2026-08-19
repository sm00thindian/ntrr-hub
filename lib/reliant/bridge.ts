import "server-only";

import {
  isReliantBridgeEnabled,
  type ReliantBridgeState,
} from "@/lib/reliant/constants";
import { createClient } from "@/lib/supabase/server";

export {
  RELIANT_SMS_URL,
  RELIANT_URL,
  isReliantBridgeEnabled,
  reliantIntentNotAllowedMessage,
  type ReliantBridgeState,
} from "@/lib/reliant/constants";

export async function getReliantBridgeState(householdId: string): Promise<ReliantBridgeState> {
  const enabled = isReliantBridgeEnabled();
  if (!enabled) {
    return { enabled: false, coordinatorConnected: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .select("reliant_connected_at")
    .eq("id", householdId)
    .maybeSingle();

  if (error) {
    console.error("[reliant-bridge] household lookup failed", error.message);
    return { enabled: true, coordinatorConnected: false };
  }

  const row = data as { reliant_connected_at?: string | null } | null;
  return {
    enabled: true,
    coordinatorConnected: Boolean(row?.reliant_connected_at),
  };
}

/**
 * Whether the household may set Reliant intent flags to true.
 * Clearing flags is always allowed in actions (callers check intent separately).
 */
export async function canSetReliantIntent(householdId: string): Promise<boolean> {
  const state = await getReliantBridgeState(householdId);
  return state.enabled && state.coordinatorConnected;
}
