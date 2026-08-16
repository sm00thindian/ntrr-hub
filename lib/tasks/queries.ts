import { resolveAssigneeDisplay } from "@/lib/households/member-label";
import { getHouseholdMembers } from "@/lib/households/queries";
import type { HouseholdPersona } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import {
  displayProvenanceSource,
  type Provenance,
} from "@/lib/provenance/types";
import { pickOpenRecurringKeeper } from "@/lib/tasks/spawn-recurring";
import type {
  RecurringTaskTemplate,
  RecurrenceCadence,
  Task,
  TaskStatus,
} from "@/lib/tasks/types";

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

/**
 * Keep a single open instance per recurring template for display.
 * Prefer current-day / non-missed when household day is known; else earliest due.
 */
export function oneOpenPerRecurringTemplate(
  tasks: Task[],
  options?: { todayKey?: string; timeZone?: string },
): Task[] {
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
    // Align with pickOpenRecurringKeeper (missed vs current, then earliest due)
    const keeperMeta = pickOpenRecurringKeeper(
      opens.map((t) => ({
        id: t.id,
        due_at: t.dueAt,
        created_at: t.createdAt,
        status: t.status,
      })),
      options,
    );
    const keeper = opens.find((t) => t.id === keeperMeta.id) ?? opens[0]!;
    result.push(keeper);
  }

  return result;
}

function inRange(isoMs: number, rangeStart: string, rangeEnd: string) {
  const start = Date.parse(rangeStart);
  const end = Date.parse(rangeEnd);
  return Number.isFinite(isoMs) && Number.isFinite(start) && Number.isFinite(end)
    ? isoMs >= start && isoMs < end
    : false;
}

/** Done today by completion time, or due today if completion time missing/odd. */
export function isTaskDoneToday(
  task: Task,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (task.status !== "done") {
    return false;
  }
  const updatedMs = Date.parse(task.updatedAt);
  if (inRange(updatedMs, rangeStart, rangeEnd)) {
    return true;
  }
  if (task.dueAt) {
    return inRange(Date.parse(task.dueAt), rangeStart, rangeEnd);
  }
  return false;
}

export type TaskBoardSections = {
  /** Open, past due */
  overdue: Task[];
  /** Open, due today or undated */
  today: Task[];
  /** Open, due after today (incl. next recurring) */
  upcoming: Task[];
  /** Completed during the current household day */
  doneToday: Task[];
  /** One-off tasks finished before today (archive) */
  history: Task[];
};

function attachCadence(
  tasks: Task[],
  cadenceMap: Record<string, RecurrenceCadence>,
): Task[] {
  return tasks.map((task) => ({
    ...task,
    recurrenceCadence: task.recurringTemplateId
      ? (cadenceMap[task.recurringTemplateId] ?? task.recurrenceCadence ?? null)
      : null,
  }));
}

function sortByDueAsc(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) {
      return aDue - bDue;
    }
    return a.title.localeCompare(b.title);
  });
}

function sortDoneRecentFirst(tasks: Task[]) {
  return [...tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * Split tasks into scannable board sections for the Tasks page.
 * Recurring: one open instance per series. One-off done before today → history.
 */
export function buildTaskBoardSections(
  tasks: Task[],
  options: {
    rangeStart: string;
    rangeEnd: string;
    nowMs?: number;
    cadenceByTemplateId?: Record<string, RecurrenceCadence>;
    /** Household wall day (YYYY-MM-DD); when set, missed prior-day opens lose to today. */
    todayKey?: string;
    timeZone?: string;
  },
): TaskBoardSections {
  const nowMs = options.nowMs ?? Date.now();
  const endMs = Date.parse(options.rangeEnd);
  const cadenceMap = options.cadenceByTemplateId ?? {};
  const withCadence = attachCadence(tasks, cadenceMap);

  const openOnly = withCadence.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );
  // oneOpenPerRecurringTemplate keeps non-recurring opens + one open per series
  const open = oneOpenPerRecurringTemplate(openOnly, {
    todayKey: options.todayKey,
    timeZone: options.timeZone,
  });

  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];

  for (const task of open) {
    if (!task.dueAt) {
      today.push(task);
      continue;
    }
    const dueMs = Date.parse(task.dueAt);
    if (dueMs < nowMs) {
      overdue.push(task);
    } else if (Number.isFinite(endMs) && dueMs < endMs) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  const doneToday = sortDoneRecentFirst(
    withCadence.filter((t) =>
      isTaskDoneToday(t, options.rangeStart, options.rangeEnd),
    ),
  );

  // One-off finished before today — archive, not the active board
  const history = sortDoneRecentFirst(
    withCadence.filter(
      (t) =>
        t.status === "done" &&
        !t.recurringTemplateId &&
        !isTaskDoneToday(t, options.rangeStart, options.rangeEnd),
    ),
  );

  return {
    overdue: sortByDueAsc(overdue),
    today: sortByDueAsc(today),
    upcoming: sortByDueAsc(upcoming),
    doneToday,
    history,
  };
}

/**
 * Flat list: open sections then done today (no history).
 * Prefer buildTaskBoardSections for the Tasks UI.
 */
export function selectBoardTasks(
  tasks: Task[],
  options?: {
    rangeStart?: string;
    rangeEnd?: string;
    cadenceByTemplateId?: Record<string, RecurrenceCadence>;
  },
): Task[] {
  if (!options?.rangeStart || !options?.rangeEnd) {
    const open = oneOpenPerRecurringTemplate(
      tasks.filter((t) => t.status === "todo" || t.status === "in_progress"),
    );
    return attachCadence(open, options?.cadenceByTemplateId ?? {}).sort((a, b) => {
      const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }

  const sections = buildTaskBoardSections(tasks, {
    rangeStart: options.rangeStart,
    rangeEnd: options.rangeEnd,
    cadenceByTemplateId: options.cadenceByTemplateId,
  });

  return [
    ...sections.overdue,
    ...sections.today,
    ...sections.upcoming,
    ...sections.doneToday,
  ];
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