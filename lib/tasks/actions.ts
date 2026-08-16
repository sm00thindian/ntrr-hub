"use server";

import { revalidatePath } from "next/cache";

import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { requireHouseholdContext } from "@/lib/households/context";
import { resolveHouseholdTimeZone, zonedWallTimeToUtcIso } from "@/lib/datetime/timezone";
import { enqueueGoogleTaskSync } from "@/lib/sync/enqueue";
import { createClient } from "@/lib/supabase/server";
import { canEditTasks } from "@/lib/permissions/roles";
import type { RecurrenceCadence, TaskStatus } from "@/lib/tasks/types";

function defaultProvenance() {
  return {
    source: "ntrr" as const,
    originSource: "ntrr" as const,
    syncedAt: new Date().toISOString(),
    confidence: "high" as const,
    lastModifiedBy: "user" as const,
  };
}

export async function createTask(formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to create tasks." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const reliantConfirmRequested =
    formData.get("reliantConfirmRequested") === "on" ||
    formData.get("reliantConfirmRequested") === "true";

  if (!title) {
    return { error: "Task title is required." };
  }

  let dueAt: string | null = null;
  if (dueAtRaw) {
    const calendarSettings = await getHouseholdCalendarSettings(ctx.householdId);
    const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
    dueAt = zonedWallTimeToUtcIso(dueAtRaw, timeZone);
    if (!dueAt) {
      return { error: "Invalid due date/time." };
    }
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      household_id: ctx.householdId,
      title,
      description,
      assignee_id: assigneeId,
      due_at: dueAt,
      status: "todo",
      reliant_confirm_requested: reliantConfirmRequested,
      provenance: defaultProvenance(),
      created_by: ctx.userId,
    })
    .select("id, title, description, status, due_at, reliant_confirm_requested")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Could not create task." };
  }

  await enqueueGoogleTaskSync({
    householdId: ctx.householdId,
    taskId: created.id,
    operation: "create",
    payload: {
      title: created.title,
      description: created.description,
      status: created.status,
      dueAt: created.due_at,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const ctx = await requireHouseholdContext();
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_at, assignee_id, recurring_template_id")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Task not found." };
  }

  const row = existing as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_at: string | null;
    assignee_id: string | null;
    recurring_template_id: string | null;
  };

  const isAssignee = row.assignee_id === ctx.userId;
  // Editors can update any task; assignees (incl. self-advocate viewers) can complete their own.
  if (!canEditTasks(ctx.role) && !isAssignee) {
    return { error: "You do not have permission to update this task." };
  }

  if (!canEditTasks(ctx.role) && isAssignee && status !== "done" && status !== "todo") {
    return { error: "You can mark your tasks done or reopen them." };
  }

  const previousStatus = row.status;
  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      status,
      provenance: defaultProvenance(),
    })
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  // RLS can fail "softly" (0 rows) — never report success unless we see the row.
  if (!updated) {
    return {
      error:
        "Could not update this task. If you are a self-advocate, ask a coordinator to set your access to Member, or ensure the task is assigned to you.",
    };
  }

  // Completing a recurring instance must open the next occurrence (daily meds, etc.).
  if (
    status === "done" &&
    previousStatus !== "done" &&
    row.recurring_template_id
  ) {
    try {
      const { spawnNextAfterCompletion } = await import("@/lib/tasks/spawn-recurring");
      await spawnNextAfterCompletion({
        householdId: ctx.householdId,
        templateId: row.recurring_template_id,
        completedDueAt: row.due_at,
        createdBy: ctx.userId,
      });
    } catch (err) {
      console.error("[updateTaskStatus] spawn next recurring failed", err);
    }
  }

  await enqueueGoogleTaskSync({
    householdId: ctx.householdId,
    taskId,
    operation: "update",
    payload: {
      title: row.title,
      description: row.description,
      status,
      dueAt: row.due_at,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true as const };
}

/** Full edit: title, notes, assignee, due, Reliant flag (not status — use updateTaskStatus). */
export async function updateTask(formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to update tasks." };
  }

  const taskId = String(formData.get("taskId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const clearDue = formData.get("clearDue") === "true" || formData.get("clearDue") === "on";
  const reliantConfirmRequested =
    formData.get("reliantConfirmRequested") === "on" ||
    formData.get("reliantConfirmRequested") === "true";

  if (!taskId) {
    return { error: "Task is required." };
  }

  if (!title) {
    return { error: "Task title is required." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tasks")
    .select("id, status, due_at")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (!existing) {
    return { error: "Task not found." };
  }

  // Empty dueAt clears the due date (edit form always submits the field).
  let dueAt: string | null = null;
  if (dueAtRaw && !clearDue) {
    const calendarSettings = await getHouseholdCalendarSettings(ctx.householdId);
    const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
    dueAt = zonedWallTimeToUtcIso(dueAtRaw, timeZone);
    if (!dueAt) {
      return { error: "Invalid due date/time." };
    }
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      title,
      description,
      assignee_id: assigneeId,
      due_at: dueAt,
      reliant_confirm_requested: reliantConfirmRequested,
      provenance: defaultProvenance(),
    })
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .select("id, title, description, status, due_at")
    .single();

  if (error || !updated) {
    return { error: error?.message ?? "Could not update task." };
  }

  await enqueueGoogleTaskSync({
    householdId: ctx.householdId,
    taskId,
    operation: "update",
    payload: {
      title: updated.title,
      description: updated.description,
      status: updated.status,
      dueAt: updated.due_at,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true };
}

/**
 * Remove a single task row from the board (any status → cancelled).
 * For recurring series, this does not deactivate the template; use deleteRecurringSeries.
 * ensure() will not re-spawn while the latest instance is cancelled (pause series).
 */
export async function pauseTask(taskId: string) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to remove tasks." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (!existing) {
    return { error: "Task not found." };
  }

  if (existing.status === "cancelled") {
    revalidatePath("/tasks");
    return { success: true as const };
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status: "cancelled", provenance: defaultProvenance() })
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  // RLS can fail softly (0 rows) without throwing
  if (!updated) {
    return {
      error:
        "Could not remove this task. You may need editor access (Member or higher), or try Delete series for a recurring template.",
    };
  }

  try {
    await enqueueGoogleTaskSync({
      householdId: ctx.householdId,
      taskId,
      operation: "delete",
    });
  } catch {
    // Local cancel already applied
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true as const };
}

/** @deprecated Prefer pauseTask — kept so older call sites keep working. */
export async function deleteTask(taskId: string) {
  return pauseTask(taskId);
}

/**
 * Delete an entire recurring series: deactivate the template and cancel open instances.
 * Done history stays for audit; no further occurrences will spawn.
 */
export async function deleteRecurringSeries(templateId: string) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to delete recurring series." };
  }

  if (!templateId.trim()) {
    return { error: "Series is required." };
  }

  const supabase = await createClient();

  const { data: template, error: templateFetchError } = await supabase
    .from("recurring_task_templates")
    .select("id")
    .eq("id", templateId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (templateFetchError || !template) {
    return { error: templateFetchError?.message ?? "Recurring series not found." };
  }

  const { error: deactivateError } = await supabase
    .from("recurring_task_templates")
    .update({ is_active: false })
    .eq("id", templateId)
    .eq("household_id", ctx.householdId);

  if (deactivateError) {
    return { error: deactivateError.message };
  }

  // Cancel every instance (open + done) so rows leave the board/history
  const { data: seriesRows } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("household_id", ctx.householdId)
    .eq("recurring_template_id", templateId)
    .neq("status", "cancelled");

  const seriesIds = (seriesRows ?? []).map((r) => r.id as string);

  if (seriesIds.length) {
    const { data: cancelled, error: cancelError } = await supabase
      .from("tasks")
      .update({ status: "cancelled", provenance: defaultProvenance() })
      .eq("household_id", ctx.householdId)
      .eq("recurring_template_id", templateId)
      .neq("status", "cancelled")
      .select("id");

    if (cancelError) {
      return { error: cancelError.message };
    }

    if (!cancelled?.length) {
      return {
        error:
          "Series was deactivated, but task rows could not be removed. Check your access role and try again.",
      };
    }

    for (const taskId of seriesIds) {
      try {
        await enqueueGoogleTaskSync({
          householdId: ctx.householdId,
          taskId,
          operation: "delete",
        });
      } catch {
        // Series already deactivated; sync can retry later.
      }
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true as const };
}

export async function createRecurringTemplate(formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to create templates." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "weekly") as RecurrenceCadence;
  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
  const dayOfWeekRaw = String(formData.get("dayOfWeek") ?? "").trim();
  const dayOfMonthRaw = String(formData.get("dayOfMonth") ?? "").trim();
  const dueTimeRaw = String(formData.get("dueTime") ?? "").trim();
  const reliantConfirmRequested =
    formData.get("reliantConfirmRequested") === "on" ||
    formData.get("reliantConfirmRequested") === "true";

  if (!title) {
    return { error: "Template title is required." };
  }

  const { parseDueTime, nextRecurringDueAt } = await import("@/lib/tasks/recurrence");
  const dueTime = parseDueTime(dueTimeRaw);
  if (dueTimeRaw && !dueTime) {
    return { error: "Enter a valid time (e.g. 09:00) or leave time blank." };
  }

  const dayOfWeek = cadence === "weekly" && dayOfWeekRaw ? Number(dayOfWeekRaw) : null;
  const dayOfMonth = cadence === "monthly" && dayOfMonthRaw ? Number(dayOfMonthRaw) : null;

  const supabase = await createClient();

  const { data: template, error: templateError } = await supabase
    .from("recurring_task_templates")
    .insert({
      household_id: ctx.householdId,
      title,
      default_assignee_id: assigneeId,
      cadence,
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      due_time: dueTime,
      reliant_confirm_requested: reliantConfirmRequested,
      created_by: ctx.userId,
    })
    .select("id, title, default_assignee_id, due_time, reliant_confirm_requested")
    .single();

  if (templateError || !template) {
    return { error: templateError?.message ?? "Could not create template." };
  }

  const row = template as {
    id: string;
    title: string;
    default_assignee_id: string | null;
    due_time?: string | null;
    reliant_confirm_requested?: boolean | null;
  };

  const calendarSettings = await getHouseholdCalendarSettings(ctx.householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const dueAt = nextRecurringDueAt({
    cadence,
    dayOfWeek,
    dayOfMonth,
    dueTime: row.due_time ?? dueTime,
    timeZone,
  });

  const { data: spawnedTask, error: taskError } = await supabase
    .from("tasks")
    .insert({
      household_id: ctx.householdId,
      title: row.title,
      assignee_id: row.default_assignee_id,
      status: "todo",
      due_at: dueAt,
      recurring_template_id: row.id,
      reliant_confirm_requested: Boolean(row.reliant_confirm_requested),
      provenance: defaultProvenance(),
      created_by: ctx.userId,
    })
    .select("id, title, description, status, due_at")
    .single();

  if (taskError || !spawnedTask) {
    return { error: taskError?.message ?? "Could not spawn recurring task." };
  }

  try {
    await enqueueGoogleTaskSync({
      householdId: ctx.householdId,
      taskId: spawnedTask.id,
      operation: "create",
      payload: {
        title: spawnedTask.title,
        description: spawnedTask.description,
        status: spawnedTask.status,
        dueAt: spawnedTask.due_at,
      },
    });
  } catch {
    // Template + first task already saved; sync can retry later.
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}