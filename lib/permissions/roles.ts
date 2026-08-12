/** Axis A — access / capability in the household */
export const HOUSEHOLD_ROLES = ["owner", "admin", "member", "viewer", "caregiver"] as const;

export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

/** Roles shown in invite / edit UIs (legacy caregiver hidden) */
export const ASSIGNABLE_HOUSEHOLD_ROLES = ["admin", "member", "viewer"] as const;

export type AssignableHouseholdRole = (typeof ASSIGNABLE_HOUSEHOLD_ROLES)[number];

/** Axis B — care relationship (independent of access) */
export const HOUSEHOLD_PERSONAS = [
  "coordinator",
  "care_partner",
  "self_advocate",
  "other",
] as const;

export type HouseholdPersona = (typeof HOUSEHOLD_PERSONAS)[number];

export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  caregiver: "Member", // legacy enum value — display as Member
};

export const HOUSEHOLD_PERSONA_LABELS: Record<HouseholdPersona, string> = {
  coordinator: "Coordinator",
  care_partner: "Care partner",
  self_advocate: "Self-advocate",
  other: "Family / other",
};

export const HOUSEHOLD_PERSONA_HINTS: Record<HouseholdPersona, string> = {
  coordinator: "Runs the board, invites, and integrations",
  care_partner: "Helps with handoffs and day-to-day tasks",
  self_advocate: "Person care is organized around; may use My day + Reliant",
  other: "Family member without a specific care role",
};

/** Short blurbs for Access (Axis A) hover help and option titles */
export const HOUSEHOLD_ROLE_HINTS: Record<HouseholdRole, string> = {
  owner: "Full household control. Cannot be assigned via invite.",
  admin: "Can manage members, invites, and calendar integrations.",
  member: "Can create and complete tasks and use the full family board.",
  viewer: "Can see the household board; limited ability to change things.",
  caregiver: "Same as Member (legacy label).",
};

export const ACCESS_FIELD_HELP =
  "Access is what they can do in Hub (permissions). It is separate from care persona.";

export const PERSONA_FIELD_HELP =
  "Care persona is their place in the care network—not login power. A self-advocate can be a Member (act) or Viewer (read).";

export const FOCUS_PERSON_FIELD_HELP =
  "Marks who care is organized around for filters and future Reliant phone confirmation routing.";

export function normalizeHouseholdRole(role: HouseholdRole | string): HouseholdRole {
  if (role === "caregiver") {
    return "member";
  }
  if ((HOUSEHOLD_ROLES as readonly string[]).includes(role)) {
    return role as HouseholdRole;
  }
  return "member";
}

/** Can create/edit/delete household tasks (not viewer-only) */
export function canEditTasks(role: HouseholdRole): boolean {
  const r = normalizeHouseholdRole(role);
  return r === "owner" || r === "admin" || r === "member" || r === "caregiver";
}

/**
 * My day / board: show complete controls when the member can edit tasks,
 * or when they are a self-advocate (may complete own assigned work as viewer).
 */
export function canCompleteOwnOrEditTasks(
  role: HouseholdRole,
  persona?: HouseholdPersona | null,
): boolean {
  if (canEditTasks(role)) {
    return true;
  }
  return persona === "self_advocate";
}

export function canManageMembers(role: HouseholdRole): boolean {
  const r = normalizeHouseholdRole(role);
  return r === "owner" || r === "admin";
}

export function canManageIntegrations(role: HouseholdRole): boolean {
  const r = normalizeHouseholdRole(role);
  return r === "owner" || r === "admin";
}

/** Future: default landing for self-advocates */
export function prefersMyDayView(persona: HouseholdPersona): boolean {
  return persona === "self_advocate";
}
