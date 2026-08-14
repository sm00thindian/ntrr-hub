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

async function insertSpawnedTask(params: {
  householdId: string;
  template: TemplateRow;
  dueAt: string | null;
  createdBy: string;
}): Promise<{ id: string; title: string; description: string | null; status: string; due_at: string | null } | null> {
  const admin = createAdminClient();
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

  // One open instance at a time per template
  const { data: openRows } = await admin
    .from("tasks")
    .select("id")
    .eq("household_id", params.householdId)
    .eq("recurring_template_id", params.templateId)
    .in("status", ["todo", "in_progress"])
    .limit(1);

  if (openRows && openRows.length > 0) {
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

  // Templates without due_time still need a next open task (undated).
  const spawned = await insertSpawnedTask({
    householdId: params.householdId,
    template: row,
    dueAt,
    createdBy: params.createdBy,
  });

  return spawned ? { spawned: true, taskId: spawned.id } : { spawned: false };
}

/**
 * Recovery: any active template with no open instance gets the next occurrence.
 * Safe to call on board/dashboard load so yesterday’s completions reappear today
 * even if spawn-on-complete was missing historically.
 */
export async function ensureHouseholdRecurringInstances(
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

    // Advance from the most recently touched instance so we don't skip a day.
    const { data: latest } = await admin
      .from("tasks")
      .select("due_at, updated_at")
      .eq("household_id", householdId)
      .eq("recurring_template_id", template.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestRow = latest as { due_at: string | null; updated_at: string } | null;
    const after = latestRow
      ? afterInstantForNextSpawn(latestRow.due_at, new Date(latestRow.updated_at))
      : new Date(Date.now() - 1);

    const dueAt = nextRecurringDueAt({
      cadence: template.cadence,
      dayOfWeek: template.day_of_week,
      dayOfMonth: template.day_of_month,
      dueTime: template.due_time,
      timeZone,
      now: after,
    });

    // Templates without due_time always get an undated open task when none is open.
    const spawnDueAt = template.due_time ? dueAt : null;
    if (template.due_time && !spawnDueAt) {
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
