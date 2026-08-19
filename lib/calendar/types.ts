import type { HouseholdPersona } from "@/lib/permissions/roles";
import type { Provenance } from "@/lib/provenance/types";
import type { TaskStatus } from "@/lib/tasks/types";

export type CalendarEvent = {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  reliantConfirmRequested?: boolean;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
};

export type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeLabel?: string | null;
  assigneePersona?: HouseholdPersona | null;
  dueAt: string;
  status: TaskStatus;
  reliantConfirmRequested?: boolean;
  reliantSmsReminderRequested?: boolean;
  provenance: Provenance;
};