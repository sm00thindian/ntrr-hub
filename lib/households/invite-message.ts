import { formatPhoneDisplay } from "@/lib/phone";

/** Shareable invite blurb (email / text). Includes Reliant mobile language when phone is set. */
export function buildInviteShareText(input: {
  householdName: string;
  inviteUrl: string;
  phoneE164?: string | null;
}) {
  const lines = [
    `You're invited to join ${input.householdName} on Hub (family care coordination).`,
    "",
    `Open this link to join: ${input.inviteUrl}`,
  ];

  if (input.phoneE164) {
    lines.push(
      "",
      `Mobile on file: ${formatPhoneDisplay(input.phoneE164)} (${input.phoneE164}).`,
      "This is the number Reliant may call when a Hub task requests phone confirmation of completion.",
      "The household coordinator’s Reliant account places the call and holds billing — you do not need your own Reliant subscription just to answer.",
      "You can update or clear your mobile anytime in Hub Settings after you join.",
    );
  }

  lines.push("", "— Not The Run Around · hub.ntrr.com · reliant.ntrr.com");
  return lines.join("\n");
}
