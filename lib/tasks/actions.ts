"use server";

import { revalidatePath } from "next/cache";

import { requireHouseholdContext } from "@/lib/households/context";
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
  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  const reliantConfirmRequested =
    formData.get("reliantConfirmRequested") === "on" ||
    formData.get("reliantConfirmRequested") === "true";

  if (!title) {
    return { error: "Task title is required." };
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
      created_by: ctx.userId,
    })
    .select("id, title, default_assignee_id")
    .single();

  if (templateError || !template) {
    return { error: templateError?.message ?? "Could not create template." };
  }

  const row = template as {
    id: string;
    title: string;
    default_assignee_id: string | null;
  };

  const { data: spawnedTask, error: taskError } = await supabase
    .from("tasks")
    .insert({
      household_id: ctx.householdId,
      title: row.title,
      assignee_id: row.default_assignee_id,
      status: "todo",
      recurring_template_id: row.id,
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