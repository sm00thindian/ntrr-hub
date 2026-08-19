import { createClient } from "@/lib/supabase/server";

export const RELIANT_URL = "https://reliant.ntrr.com";
export const RELIANT_SMS_URL = "https://reliant.ntrr.com/sms";

export type ReliantBridgeState = {
  /** Master ENV gate — when false, hide all Reliant request UI */
  enabled: boolean;
  /** Coordinator self-attest (dogfood) / later active plan */
  coordinatorConnected: boolean;
};

/** True when Reliant phone/SMS request options may appear (ENV on). */
export function isReliantBridgeEnabled(): boolean {
  const raw =
    process.env.RELIANT_BRIDGE_ENABLED ?? process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED ?? "";
  return raw === "true" || raw === "1";
}

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

export function reliantIntentNotAllowedMessage(state: ReliantBridgeState): string {
  if (!state.enabled) {
    return "Reliant phone and SMS requests are not enabled for this environment.";
  }
  return "Connect Reliant for this household in Settings before requesting phone confirms or SMS reminders.";
}
