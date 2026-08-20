/** Client-safe Reliant bridge constants (no next/headers / server clients). */

export const RELIANT_URL = "https://reliant.ntrr.com";
export const RELIANT_SMS_URL = "https://reliant.ntrr.com/sms";

export type ReliantBridgeState = {
  /** Master ENV gate — when false, Reliant request UI is shown greyed / disabled */
  enabled: boolean;
  /** Coordinator self-attest (dogfood) / later active plan */
  coordinatorConnected: boolean;
};

/** True when Reliant phone/SMS request options are interactive (ENV on). */
export function isReliantBridgeEnabled(): boolean {
  const raw =
    process.env.RELIANT_BRIDGE_ENABLED ?? process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED ?? "";
  return raw === "true" || raw === "1";
}

export function reliantIntentNotAllowedMessage(state: ReliantBridgeState): string {
  if (!state.enabled) {
    return "Reliant phone and SMS requests are not enabled for this environment.";
  }
  return "Connect Reliant for this household in Settings before requesting phone confirms or SMS reminders.";
}
