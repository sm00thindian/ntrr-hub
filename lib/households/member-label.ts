import type { HouseholdPersona } from "@/lib/permissions/roles";

/** Short, human label for a household member (display name, else local-part of email). */
export function memberDisplayLabel(
  email: string | null | undefined,
  displayName?: string | null,
): string {
  if (displayName?.trim()) {
    return displayName.trim();
  }
  if (!email) {
    return "Unknown";
  }
  const local = email.split("@")[0]?.trim();
  return local || email;
}

export type AssigneeDisplay = {
  id: string | null;
  label: string | null;
  email: string | null;
  persona: HouseholdPersona | null;
};

export function resolveAssigneeDisplay(
  assigneeId: string | null | undefined,
  members: Array<{
    userId: string;
    email: string;
    displayName: string | null;
    persona?: HouseholdPersona | null;
  }>,
): AssigneeDisplay {
  if (!assigneeId) {
    return { id: null, label: null, email: null, persona: null };
  }
  const member = members.find((m) => m.userId === assigneeId);
  if (!member) {
    return { id: assigneeId, label: "Assigned", email: null, persona: null };
  }
  return {
    id: assigneeId,
    label: memberDisplayLabel(member.email, member.displayName),
    email: member.email,
    persona: member.persona ?? null,
  };
}
