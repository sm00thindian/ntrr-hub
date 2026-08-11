import { resolveAssigneeDisplay } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import type { HouseholdPersona } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import type { Provenance } from "@/lib/provenance/types";
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
    reliantConfirmRequested: Boolean(row.reliant_confirm_requested),
    provenance: row.provenance,
    recurringTemplateId: row.recurring_template_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getHouseholdTasks(householdId: string): Promise<Task[]> {
  const supabase = await createClient();

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