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
  dueAt: string | null;
  /** When true, Reliant should request phone confirmation for this task */
  reliantConfirmRequested: boolean;
  provenance: Provenance;
  recurringTemplateId: string | null;
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

export const KANBAN_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];