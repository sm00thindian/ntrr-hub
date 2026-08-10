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
      "This number is used so Hub can correlate you with Reliant (phone-first reliability).",
      "When a task or event requests Reliant confirmation, Reliant may call this number until you confirm — optional, tiered phone accountability under Not The Run Around.",
      "You can update or clear your mobile anytime in Hub Settings after you join.",
    );
  }

  lines.push("", "— Not The Run Around · hub.ntrr.com · reliant.ntrr.com");
  return lines.join("\n");
}
