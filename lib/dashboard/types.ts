import type { HouseholdPersona } from "@/lib/permissions/roles";
import type { ProvenanceSource } from "@/lib/provenance/types";
import type { TaskStatus } from "@/lib/tasks/types";

export type AgendaItemKind = "task" | "event";

export type AgendaItem = {
  id: string;
  kind: AgendaItemKind;
  title: string;
  sortAt: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string | null;
  source: ProvenanceSource;
  status?: TaskStatus;
  href?: string;
  /** Task/event requests Reliant phone confirmation */
  reliantConfirmRequested?: boolean;
  /** Task requests Reliant SMS reminder */
  reliantSmsReminderRequested?: boolean;
  /** Underlying DB id (task uuid or event uuid) for actions */
  entityId?: string;
  /** Task assignee user id (for member color chips) */
  assigneeId?: string | null;
  /** Task assignee short label (for multi-person households) */
  assigneeLabel?: string | null;
  /** Task assignee care persona */
  assigneePersona?: HouseholdPersona | null;
};