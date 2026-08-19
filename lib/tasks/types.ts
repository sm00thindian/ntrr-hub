import type { HouseholdPersona } from "@/lib/permissions/roles";
import type { Provenance } from "@/lib/provenance/types";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type RecurrenceCadence = "daily" | "weekly" | "monthly";

export type Task = {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeEmail: string | null;
  /** Short label for UI (display name or email local-part) */
  assigneeLabel: string | null;
  /** Care persona of assignee when known — helps when multiple self-advocates */
  assigneePersona: HouseholdPersona | null;
  dueAt: string | null;
  /** When true, Reliant should request phone confirmation for this task */
  reliantConfirmRequested: boolean;
  /** When true, Reliant should send a soft SMS reminder for this task */
  reliantSmsReminderRequested: boolean;
  provenance: Provenance;
  recurringTemplateId: string | null;
  /** From linked template when known — for Daily / Weekly / Monthly chip */
  recurrenceCadence?: RecurrenceCadence | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RecurringTaskTemplate = {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  defaultAssigneeId: string | null;
  cadence: RecurrenceCadence;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  /** Optional local time of day HH:mm in household timezone */
  dueTime: string | null;
  /** Default Reliant phone confirmation for each spawned instance */
  reliantConfirmRequested: boolean;
  /** Default Reliant SMS reminder for each spawned instance */
  reliantSmsReminderRequested: boolean;
  isActive: boolean;
  createdAt: string;
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const RECURRENCE_CADENCE_LABELS: Record<RecurrenceCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const KANBAN_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];