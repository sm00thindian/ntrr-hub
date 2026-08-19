import { humanizeEmailLocalPart } from "@/lib/households/member-label";
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

export function PersonaBadge({ persona }: { persona: HouseholdPersona | string | null | undefined }) {
  const key = (persona && persona in HOUSEHOLD_PERSONA_LABELS
    ? persona
    : "other") as HouseholdPersona;
  return (
    <span
      title={HOUSEHOLD_PERSONA_HINTS[key]}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        personaStyles[key],
      )}
    >
      {HOUSEHOLD_PERSONA_LABELS[key]}
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

export function ReliantSmsReminderChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-950 dark:text-sky-200",
        className,
      )}
      title="SMS reminder via Reliant is requested for this item"
    >
      SMS
    </span>
  );
}

/**
 * Who owns a task — display name only, with persona-tinted colors when known.
 * Email may appear in the hover title; persona label is not shown in the chip.
 */
export function AssigneeChip({
  label,
  persona,
  email,
  unassigned,
  className,
}: {
  label?: string | null;
  persona?: HouseholdPersona | string | null;
  email?: string | null;
  unassigned?: boolean;
  className?: string;
}) {
  if (unassigned || !label) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        Unassigned
      </span>
    );
  }

  // Never show a raw email as the chip text
  const displayLabel = label.includes("@") ? humanizeEmailLocalPart(label) : label;

  const personaKey = (persona && persona in HOUSEHOLD_PERSONA_LABELS
    ? persona
    : null) as HouseholdPersona | null;

  const titleParts = [
    email && email !== displayLabel ? email : null,
    personaKey ? HOUSEHOLD_PERSONA_LABELS[personaKey] : null,
  ].filter(Boolean);

  return (
    <span
      title={titleParts.length ? titleParts.join(" · ") : displayLabel}
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground",
        personaKey === "self_advocate" &&
          "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
        personaKey === "care_partner" &&
          "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
        personaKey === "coordinator" &&
          "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
        className,
      )}
    >
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
