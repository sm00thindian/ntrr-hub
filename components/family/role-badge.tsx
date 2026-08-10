import { cn } from "@/lib/utils";
import {
  HOUSEHOLD_PERSONA_HINTS,
  HOUSEHOLD_PERSONA_LABELS,
  HOUSEHOLD_ROLE_HINTS,
  HOUSEHOLD_ROLE_LABELS,
  type HouseholdPersona,
  type HouseholdRole,
  normalizeHouseholdRole,
} from "@/lib/permissions/roles";

const roleStyles: Record<string, string> = {
  owner: "bg-primary/15 text-primary",
  admin: "bg-accent text-accent-foreground",
  member: "bg-secondary text-secondary-foreground",
  caregiver: "bg-secondary text-secondary-foreground",
  viewer: "bg-muted text-muted-foreground",
};

const personaStyles: Record<HouseholdPersona, string> = {
  coordinator: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  care_partner: "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  self_advocate: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  other: "bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: HouseholdRole }) {
  const normalized = normalizeHouseholdRole(role);
  return (
    <span
      title={HOUSEHOLD_ROLE_HINTS[role] ?? HOUSEHOLD_ROLE_HINTS[normalized]}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        roleStyles[normalized] ?? roleStyles.member,
      )}
    >
      {HOUSEHOLD_ROLE_LABELS[role] ?? HOUSEHOLD_ROLE_LABELS[normalized]}
    </span>
  );
}

export function PersonaBadge({ persona }: { persona: HouseholdPersona }) {
  return (
    <span
      title={HOUSEHOLD_PERSONA_HINTS[persona]}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        personaStyles[persona],
      )}
    >
      {HOUSEHOLD_PERSONA_LABELS[persona]}
    </span>
  );
}

export function ReliantConfirmChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        className,
      )}
      title="Phone confirmation via Reliant is requested for this item"
    >
      Reliant
    </span>
  );
}
