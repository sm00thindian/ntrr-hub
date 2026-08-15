import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueGoogleTaskSync } from "@/lib/sync/enqueue";
import { nextRecurringDueAt } from "@/lib/tasks/recurrence";
import type { RecurrenceCadence } from "@/lib/tasks/types";

function systemProvenance() {
  return {
    source: "ntrr" as const,
    originSource: "ntrr" as const,
    syncedAt: new Date().toISOString(),
    confidence: "high" as const,
    lastModifiedBy: "system" as const,
  };
}

/**
 * Search for the next occurrence strictly after the completed instance's due time
 * (or after "now" when the instance had no due). Avoids spawning a same-day duplicate
 * when someone completes early.
 */
export function afterInstantForNextSpawn(
  completedDueAt: string | null | undefined,
  completedAt: Date = new Date(),
): Date {
  if (completedDueAt) {
    const dueMs = Date.parse(completedDueAt);
    if (Number.isFinite(dueMs)) {
      return new Date(dueMs + 1);
    }
  }
  return completedAt;
}

type TemplateRow = {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  default_assignee_id: string | null;
  cadence: RecurrenceCadence;
  day_of_week: number | null;
  day_of_month: number | null;
  due_time: string | null;
  reliant_confirm_requested: boolean | null;
  is_active: boolean;
};

type OpenRecurringRow = {
  id: string;
  recurring_template_id: string | null;
  due_at: string | null;
  created_at: string;
  status: string;
};

/**
 * Prefer the earliest due among open dups (today/overdue before tomorrow).
 * Keeping "latest due" cancelled today's care instances when a future open existed.
 */
export function pickOpenRecurringKeeper<T extends { due_at: string | null; created_at: string; status: string }>(
  opens: T[],
): T {
  return [...opens].sort((a, b) => {
    // in_progress before todo
    if (a.status !== b.status) {
      if (a.status === "in_progress") return -1;
      if (b.status === "in_progress") return 1;
    }
    const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
    // Earliest due first — do not drop "today" for a tomorrow spawn
    if (aDue !== bDue) {
      return aDue - bDue;
    }
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  })[0]!;
}

async function countOpenForTemplate(
  admin: ReturnType<typeof createAdminClient>,
  householdId: string,
  templateId: string,
): Promise<number> {
  const { count } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("recurring_template_id", templateId)
    .in("status", ["todo", "in_progress"]);
  return count ?? 0;
}

async function insertSpawnedTask(params: {
  householdId: string;
  template: TemplateRow;
  dueAt: string | null;
  createdBy: string;
}): Promise<{ id: string; title: string; description: string | null; status: string; due_at: string | null } | null> {
  const admin = createAdminClient();

  // Re-check immediately before insert (dashboard can call ensure in parallel).
  if ((await countOpenForTemplate(admin, params.householdId, params.template.id)) > 0) {
    return null;
  }

  const { data, error } = await admin
    .from("tasks")
    .insert({
      household_id: params.householdId,
      title: params.template.title,
      description: params.template.description,
      assignee_id: params.template.default_assignee_id,
      status: "todo",
      due_at: params.dueAt,
      recurring_template_id: params.template.id,
      reliant_confirm_requested: Boolean(params.template.reliant_confirm_requested),
      provenance: systemProvenance(),
      created_by: params.createdBy,
    })
    .select("id, title, description, status, due_at")
    .single();

  if (error || !data) {
    // Unique partial index or race — treat as "already has an open instance"
    if (error?.code === "23505") {
      return null;
    }
    console.error("[spawn-recurring] insert failed", error?.message);
    return null;
  }

  try {
    await enqueueGoogleTaskSync({
      householdId: params.householdId,
      taskId: data.id,
      operation: "create",
      payload: {
        title: data.title,
        description: data.description,
        status: data.status,
        dueAt: data.due_at,
      },
    });
  } catch {
    // Instance is saved; sync can retry later.
  }

  return data;
}

/**
 * Cancel extra open instances so each template has at most one.
 * Keeps the most current open card (latest due / in progress).
 */
export async function collapseDuplicateOpenRecurring(householdId: string): Promise<number> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return 0;
  }

  const { data: openRows } = await admin
    .from("tasks")
    .select("id, recurring_template_id, due_at, created_at, status")
    .eq("household_id", householdId)
    .in("status", ["todo", "in_progress"])
    .not("recurring_template_id", "is", null);

  if (!openRows?.length) {
    return 0;
  }

  const byTemplate = new Map<string, OpenRecurringRow[]>();
  for (const raw of openRows) {
    const row = raw as OpenRecurringRow;
    if (!row.recurring_template_id) continue;
    const list = byTemplate.get(row.recurring_template_id) ?? [];
    list.push(row);
    byTemplate.set(row.recurring_template_id, list);
  }

  let cancelled = 0;
  for (const [, opens] of byTemplate) {
    if (opens.length <= 1) continue;
    const keeper = pickOpenRecurringKeeper(opens);
    const extras = opens.filter((o) => o.id !== keeper.id);
    for (const extra of extras) {
      const { error } = await admin
        .from("tasks")
        .update({
          status: "cancelled",
          provenance: systemProvenance(),
        })
        .eq("id", extra.id)
        .eq("household_id", householdId)
        .in("status", ["todo", "in_progress"]);
      if (!error) {
        cancelled += 1;
      }
    }
  }

  return cancelled;
}

/**
 * After a recurring instance is completed, spawn the next open instance if needed.
 * Uses the service role so self-advocates can complete without insert rights.
 */
export async function spawnNextAfterCompletion(params: {
  householdId: string;
  templateId: string;
  completedDueAt: string | null;
  createdBy: string;
}): Promise<{ spawned: boolean; taskId?: string }> {
  const admin = createAdminClient();

  const { data: template, error: templateError } = await admin
    .from("recurring_task_templates")
    .select(
      "id, household_id, title, description, default_assignee_id, cadence, day_of_week, day_of_month, due_time, reliant_confirm_requested, is_active",
    )
    .eq("id", params.templateId)
    .eq("household_id", params.householdId)
    .maybeSingle();

  if (templateError || !template) {
    return { spawned: false };
  }

  const row = template as TemplateRow;
  if (!row.is_active) {
    return { spawned: false };
  }

  // Collapse any prior race dups, then ensure at most one open.
  await collapseDuplicateOpenRecurring(params.householdId);

  if ((await countOpenForTemplate(admin, params.householdId, params.templateId)) > 0) {
    return { spawned: false };
  }

  const calendarSettings = await getHouseholdCalendarSettings(params.householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const after = afterInstantForNextSpawn(params.completedDueAt);
  const dueAt = nextRecurringDueAt({
    cadence: row.cadence,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    dueTime: row.due_time,
    timeZone,
    now: after,
  });

  const spawnDueAt = row.due_time ? dueAt : null;
  if (row.due_time && !spawnDueAt) {
    return { spawned: false };
  }

  const spawned = await insertSpawnedTask({
    householdId: params.householdId,
    template: row,
    dueAt: spawnDueAt,
    createdBy: params.createdBy,
  });

  return spawned ? { spawned: true, taskId: spawned.id } : { spawned: false };
}

/** Dedupe concurrent ensure() calls for the same household in one server process. */
const ensureInFlight = new Map<string, Promise<number>>();

/**
 * Recovery: collapse dups, then any active template with no open instance gets the next occurrence.
 * Safe to call on board/dashboard load; parallel callers share one in-flight run.
 */
export async function ensureHouseholdRecurringInstances(
  householdId: string,
  createdBy: string,
): Promise<number> {
  const existing = ensureInFlight.get(householdId);
  if (existing) {
    return existing;
  }

  const run = runEnsureHouseholdRecurringInstances(householdId, createdBy).finally(() => {
    ensureInFlight.delete(householdId);
  });
  ensureInFlight.set(householdId, run);
  return run;
}

async function runEnsureHouseholdRecurringInstances(
  householdId: string,
  createdBy: string,
): Promise<number> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Local/dev without service role — skip recovery rather than break reads.
    return 0;
  }

  // First: clean race duplicates so we never stack multiple brush-teeth cards.
  await collapseDuplicateOpenRecurring(householdId);

  const { data: templates } = await admin
    .from("recurring_task_templates")
    .select(
      "id, household_id, title, description, default_assignee_id, cadence, day_of_week, day_of_month, due_time, reliant_confirm_requested, is_active",
    )
    .eq("household_id", householdId)
    .eq("is_active", true);

  if (!templates?.length) {
    return 0;
  }

  const { data: openTasks } = await admin
    .from("tasks")
    .select("recurring_template_id")
    .eq("household_id", householdId)
    .in("status", ["todo", "in_progress"])
    .not("recurring_template_id", "is", null);

  const openTemplateIds = new Set(
    (openTasks ?? [])
      .map((t) => t.recurring_template_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  const calendarSettings = await getHouseholdCalendarSettings(householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);

  let spawnedCount = 0;

  for (const raw of templates) {
    const template = raw as TemplateRow;
    if (openTemplateIds.has(template.id)) {
      continue;
    }

    // Latest instance for this series (any status).
    const { data: latestAny } = await admin
      .from("tasks")
      .select("status, due_at, updated_at")
      .eq("household_id", householdId)
      .eq("recurring_template_id", template.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = latestAny as {
      status: string;
      due_at: string | null;
      updated_at: string;
    } | null;

    // User deleted the open card (cancelled) → leave the series paused.
    // Only recover when the latest instance is *done* (spawn-on-complete missed)
    // or there is no history yet (template created but first task failed).
    if (latest?.status === "cancelled") {
      continue;
    }
    if (latest && latest.status !== "done") {
      // Unexpected open status that wasn't in openTemplateIds — skip.
      continue;
    }

    const after = latest
      ? afterInstantForNextSpawn(latest.due_at, new Date(latest.updated_at))
      : new Date(Date.now() - 1);

    const dueAt = nextRecurringDueAt({
      cadence: template.cadence,
      dayOfWeek: template.day_of_week,
      dayOfMonth: template.day_of_month,
      dueTime: template.due_time,
      timeZone,
      now: after,
    });

    const spawnDueAt = template.due_time ? dueAt : null;
    if (template.due_time && !spawnDueAt) {
      continue;
    }

    // Final open check right before insert
    if ((await countOpenForTemplate(admin, householdId, template.id)) > 0) {
      openTemplateIds.add(template.id);
      continue;
    }

    const spawned = await insertSpawnedTask({
      householdId,
      template,
      dueAt: spawnDueAt,
      createdBy,
    });
    if (spawned) {
      spawnedCount += 1;
      openTemplateIds.add(template.id);
    }
  }

  return spawnedCount;
}
