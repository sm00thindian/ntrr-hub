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

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to update tasks." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_at")
    .eq("id", taskId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      provenance: defaultProvenance(),
    })
    .eq("id", taskId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  if (existing) {
    await enqueueGoogleTaskSync({
      householdId: ctx.householdId,
      taskId,
      operation: "update",
      payload: {
        title: existing.title,
        description: existing.description,
        status,
        dueAt: existing.due_at,
      },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
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

export async function deleteTask(taskId: string) {
  const ctx = await requireHouseholdContext();

  if (!canEditTasks(ctx.role)) {
    return { error: "You do not have permission to delete tasks." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ status: "cancelled", provenance: defaultProvenance() })
    .eq("id", taskId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  await enqueueGoogleTaskSync({
    householdId: ctx.householdId,
    taskId,
    operation: "delete",
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
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
  const reliantConfirmRequested =
    formData.get("reliantConfirmRequested") === "on" ||
    formData.get("reliantConfirmRequested") === "true";

  if (!title) {
    return { error: "Template title is required." };
  }

  const supabase = await createClient();

  const { data: template, error: templateError } = await supabase
    .from("recurring_task_templates")
    .insert({
      household_id: ctx.householdId,
      title,
      default_assignee_id: assigneeId,
      cadence,
      day_of_week: cadence === "weekly" && dayOfWeekRaw ? Number(dayOfWeekRaw) : null,
      day_of_month: cadence === "monthly" && dayOfMonthRaw ? Number(dayOfMonthRaw) : null,
      reliant_confirm_requested: reliantConfirmRequested,
      created_by: ctx.userId,
    })
    .select("id, title, default_assignee_id, reliant_confirm_requested")
    .single();

  if (templateError || !template) {
    return { error: templateError?.message ?? "Could not create template." };
  }

  const row = template as {
    id: string;
    title: string;
    default_assignee_id: string | null;
    reliant_confirm_requested?: boolean | null;
  };

  const { data: spawnedTask, error: taskError } = await supabase
    .from("tasks")
    .insert({
      household_id: ctx.householdId,
      title: row.title,
      assignee_id: row.default_assignee_id,
      status: "todo",
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

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}