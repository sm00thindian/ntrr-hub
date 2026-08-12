import type { HouseholdPersona } from "@/lib/permissions/roles";

/**
 * Turn an email local-part into a readable name when no display_name is set.
 * e.g. jane.doe+tag@example.com → "Jane Doe"
 * Never returns a full email address.
 */
export function humanizeEmailLocalPart(email: string): string {
  const local = (email.split("@")[0] ?? "").trim();
  if (!local) {
    return "Member";
  }

  const base = (local.split("+")[0] ?? local).replace(/[._-]+/g, " ").trim();
  if (!base) {
    return "Member";
  }

  return base
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Short, human label for a household member.
 * Prefer display name; otherwise a humanized email local-part — never full email.
 */
export function memberDisplayLabel(
  email: string | null | undefined,
  displayName?: string | null,
): string {
  const name = displayName?.trim();
  if (name) {
    // Guard: never surface a raw email as the "name"
    return name.includes("@") ? humanizeEmailLocalPart(name) : name;
  }
  if (!email) {
    return "Unknown";
  }
  return humanizeEmailLocalPart(email);
}

/** Name from auth provider metadata (Google, etc.). */
export function displayNameFromAuthMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) {
    return null;
  }

  const fullName = pickString(metadata, ["full_name", "name", "display_name"]);
  if (fullName) {
    return fullName;
  }

  const given = pickString(metadata, ["given_name", "first_name"]);
  const family = pickString(metadata, ["family_name", "last_name"]);
  if (given && family) {
    return `${given} ${family}`;
  }
  if (given) {
    return given;
  }

  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
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
