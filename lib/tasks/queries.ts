import { resolveAssigneeDisplay } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import type { HouseholdPersona } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import {
  displayProvenanceSource,
  type Provenance,
} from "@/lib/provenance/types";
import type { RecurringTaskTemplate, RecurrenceCadence, Task, TaskStatus } from "@/lib/tasks/types";

function mapTask(
  row: {
    id: string;
    household_id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    assignee_id: string | null;
    due_at: string | null;
    reliant_confirm_requested?: boolean | null;
    provenance: Provenance;
    recurring_template_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  },
  assignee: {
    email: string | null;
    label: string | null;
    persona: HouseholdPersona | null;
  },
): Task {
  const reliantConfirmRequested = Boolean(row.reliant_confirm_requested);
  const source = displayProvenanceSource(row.provenance, {
    provenance: row.provenance,
    assignee_id: row.assignee_id,
    reliant_confirm_requested: reliantConfirmRequested,
    recurring_template_id: row.recurring_template_id,
  });

  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    assigneeEmail: assignee.email,
    assigneeLabel: assignee.label,
    assigneePersona: assignee.persona,
    dueAt: row.due_at,
    reliantConfirmRequested,
    provenance: {
      ...row.provenance,
      source,
    },
    recurringTemplateId: row.recurring_template_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Keep a single open instance per recurring template (latest due / in progress). */
export function oneOpenPerRecurringTemplate(tasks: Task[]): Task[] {
  const openByTemplate = new Map<string, Task[]>();
  const result: Task[] = [];

  for (const task of tasks) {
    if (!task.recurringTemplateId || task.status === "done" || task.status === "cancelled") {
      result.push(task);
      continue;
    }
    const list = openByTemplate.get(task.recurringTemplateId) ?? [];
    list.push(task);
    openByTemplate.set(task.recurringTemplateId, list);
  }

  for (const opens of openByTemplate.values()) {
    if (opens.length === 1) {
      result.push(opens[0]!);
      continue;
    }
    const sorted = [...opens].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "in_progress") return -1;
        if (b.status === "in_progress") return 1;
      }
      const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.NEGATIVE_INFINITY;
      const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.NEGATIVE_INFINITY;
      if (aDue !== bDue) return bDue - aDue;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    result.push(sorted[0]!);
  }

  return result;
}

/**
 * Board rule for recurring series:
 * - one open card (todo / in_progress)
 * - hide done history so the board is not a stack of past meds / brush-teeth
 */
export function selectBoardTasks(tasks: Task[]): Task[] {
  const deduped = oneOpenPerRecurringTemplate(tasks).filter((task) => {
    if (!task.recurringTemplateId) {
      return true;
    }
    // Recurring series: only surface the open card on the board
    return task.status !== "done" && task.status !== "cancelled";
  });

  return deduped.sort((a, b) => {
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export async function getHouseholdTasks(householdId: string): Promise<Task[]> {
  const supabase = await createClient();

  // Collapse dups + spawn missing open instance once per load (deduped in-process).
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { ensureHouseholdRecurringInstances } = await import("@/lib/tasks/spawn-recurring");
      await ensureHouseholdRecurringInstances(householdId, user.id);
    }
  } catch {
    // Never block the board on recovery failures.
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("household_id", householdId)
    .neq("status", "cancelled")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  const members = await getHouseholdMembers(householdId);

  return data.map((row) => {
    const task = row as Parameters<typeof mapTask>[0];
    const assignee = resolveAssigneeDisplay(task.assignee_id, members);
    return mapTask(task, {
      email: assignee.email,
      label: assignee.label,
      persona: assignee.persona,
    });
  });
}

export async function getRecurringTemplates(householdId: string): Promise<RecurringTaskTemplate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_task_templates")
    .select("*")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const template = row as {
      id: string;
      household_id: string;
      title: string;
      description: string | null;
      default_assignee_id: string | null;
      cadence: RecurrenceCadence;
      day_of_week: number | null;
      day_of_month: number | null;
      due_time?: string | null;
      reliant_confirm_requested?: boolean | null;
      is_active: boolean;
      created_at: string;
    };
    return {
      id: template.id,
      householdId: template.household_id,
      title: template.title,
      description: template.description,
      defaultAssigneeId: template.default_assignee_id,
      cadence: template.cadence,
      dayOfWeek: template.day_of_week,
      dayOfMonth: template.day_of_month,
      dueTime: template.due_time ?? null,
      reliantConfirmRequested: Boolean(template.reliant_confirm_requested),
      isActive: template.is_active,
      createdAt: template.created_at,
    };
  });
}

export async function getTodayTaskCount(householdId: string): Promise<number> {
  const tasks = await getHouseholdTasks(householdId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter((task) => {
    if (task.status === "done") {
      return false;
    }
    if (!task.dueAt) {
      return task.status === "todo" || task.status === "in_progress";
    }
    const due = new Date(task.dueAt);
    return due < tomorrow;
  }).length;
}