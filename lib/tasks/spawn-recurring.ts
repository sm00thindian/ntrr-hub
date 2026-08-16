import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import {
  calendarDateKeyInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
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

/** Provenance for occurrences archived because the household day moved on. */
function missedOccurrenceProvenance() {
  return {
    ...systemProvenance(),
    // Distinguish from user pause so ensure can recover if spawn failed mid-roll.
    archiveReason: "missed_occurrence" as const,
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

/**
 * True when an open instance's due wall day is before the household's current day.
 * Undated instances are never "missed" by calendar day (still the only open card).
 */
export function isRecurringDueMissed(
  dueAt: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!dueAt) {
    return false;
  }
  const dueMs = Date.parse(dueAt);
  if (!Number.isFinite(dueMs)) {
    return false;
  }
  const zone = resolveHouseholdTimeZone(timeZone);
  const todayKey = calendarDateKeyInZone(now.toISOString(), zone);
  return isRecurringDueBeforeWallDay(dueAt, zone, todayKey);
}

/** Compare a due ISO to a known household wall day key (YYYY-MM-DD). */
export function isRecurringDueBeforeWallDay(
  dueAt: string | null | undefined,
  timeZone: string,
  todayKey: string,
): boolean {
  if (!dueAt) {
    return false;
  }
  const dueMs = Date.parse(dueAt);
  if (!Number.isFinite(dueMs)) {
    return false;
  }
  const zone = resolveHouseholdTimeZone(timeZone);
  return calendarDateKeyInZone(dueAt, zone) < todayKey;
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

export type PickOpenRecurringKeeperOptions = {
  /** Household wall "today" (YYYY-MM-DD). When set, current-day opens beat missed ones. */
  todayKey?: string;
  timeZone?: string;
};

/**
 * Prefer the single open card that should stay actionable.
 * With household day context: non-missed (today/future/undated) over prior days,
 * then earliest among those, then in_progress.
 * Without context: earliest due (legacy).
 */
export function pickOpenRecurringKeeper<
  T extends { id: string; due_at: string | null; created_at: string; status: string },
>(opens: T[], options?: PickOpenRecurringKeeperOptions): T {
  const zone = options?.timeZone
    ? resolveHouseholdTimeZone(options.timeZone)
    : null;
  const todayKey = options?.todayKey;

  return [...opens].sort((a, b) => {
    if (todayKey && zone) {
      const aMissed = isRecurringDueBeforeWallDay(a.due_at, zone, todayKey);
      const bMissed = isRecurringDueBeforeWallDay(b.due_at, zone, todayKey);
      if (aMissed !== bMissed) {
        // Keep non-missed (current day / upcoming)
        return aMissed ? 1 : -1;
      }
    }
    // in_progress before todo
    if (a.status !== b.status) {
      if (a.status === "in_progress") return -1;
      if (b.status === "in_progress") return 1;
    }
    const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
    // Earliest due first among same missed/current class
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
 * Prefers the current-day (or non-missed) card when household day is known.
 */
export async function collapseDuplicateOpenRecurring(
  householdId: string,
  options?: { timeZone?: string; now?: Date },
): Promise<number> {
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

  const zone = options?.timeZone
    ? resolveHouseholdTimeZone(options.timeZone)
    : null;
  const now = options?.now ?? new Date();
  const todayKey = zone
    ? calendarDateKeyInZone(now.toISOString(), zone)
    : undefined;

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
    const keeper = pickOpenRecurringKeeper(opens, {
      todayKey,
      timeZone: zone ?? undefined,
    });
    const extras = opens.filter((o) => o.id !== keeper.id);
    for (const extra of extras) {
      const missed =
        zone && todayKey
          ? isRecurringDueBeforeWallDay(extra.due_at, zone, todayKey)
          : false;
      const { error } = await admin
        .from("tasks")
        .update({
          status: "cancelled",
          provenance: missed ? missedOccurrenceProvenance() : systemProvenance(),
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
 * Archive open recurring instances whose due day is before today, then open the
 * current occurrence. One actionable card per series — missed days stay in the
 * DB as cancelled (hidden from the board) for audit.
 */
export async function rollForwardMissedRecurringInstances(params: {
  householdId: string;
  createdBy: string;
  timeZone: string;
  now?: Date;
}): Promise<{ archived: number; spawned: number }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { archived: 0, spawned: 0 };
  }

  const zone = resolveHouseholdTimeZone(params.timeZone);
  const now = params.now ?? new Date();
  const todayKey = calendarDateKeyInZone(now.toISOString(), zone);

  const { data: openRows } = await admin
    .from("tasks")
    .select("id, recurring_template_id, due_at, created_at, status")
    .eq("household_id", params.householdId)
    .in("status", ["todo", "in_progress"])
    .not("recurring_template_id", "is", null);

  if (!openRows?.length) {
    return { archived: 0, spawned: 0 };
  }

  const templatesNeedingSpawn = new Set<string>();
  let archived = 0;

  for (const raw of openRows) {
    const row = raw as OpenRecurringRow;
    if (!row.recurring_template_id) continue;
    if (!isRecurringDueBeforeWallDay(row.due_at, zone, todayKey)) {
      continue;
    }

    const { error } = await admin
      .from("tasks")
      .update({
        status: "cancelled",
        provenance: missedOccurrenceProvenance(),
      })
      .eq("id", row.id)
      .eq("household_id", params.householdId)
      .in("status", ["todo", "in_progress"]);

    if (!error) {
      archived += 1;
      templatesNeedingSpawn.add(row.recurring_template_id);
    }
  }

  if (!templatesNeedingSpawn.size) {
    return { archived, spawned: 0 };
  }

  const { data: templates } = await admin
    .from("recurring_task_templates")
    .select(
      "id, household_id, title, description, default_assignee_id, cadence, day_of_week, day_of_month, due_time, reliant_confirm_requested, is_active",
    )
    .eq("household_id", params.householdId)
    .eq("is_active", true)
    .in("id", [...templatesNeedingSpawn]);

  let spawned = 0;
  for (const raw of templates ?? []) {
    const template = raw as TemplateRow;
    if (!template.is_active) continue;
    if ((await countOpenForTemplate(admin, params.householdId, template.id)) > 0) {
      continue;
    }

    // Current slot for this series (today when cadence matches, even if clock time passed).
    const dueAt = nextRecurringDueAt({
      cadence: template.cadence,
      dayOfWeek: template.day_of_week,
      dayOfMonth: template.day_of_month,
      dueTime: template.due_time,
      timeZone: zone,
      now,
      includePastOnStartDay: true,
    });

    const spawnDueAt = template.due_time ? dueAt : null;
    if (template.due_time && !spawnDueAt) {
      continue;
    }

    const inserted = await insertSpawnedTask({
      householdId: params.householdId,
      template,
      dueAt: spawnDueAt,
      createdBy: params.createdBy,
    });
    if (inserted) {
      spawned += 1;
    }
  }

  return { archived, spawned };
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

  const calendarSettings = await getHouseholdCalendarSettings(householdId);
  const timeZone = resolveHouseholdTimeZone(calendarSettings.timezone);
  const now = new Date();

  // First: clean race duplicates so we never stack multiple brush-teeth cards.
  await collapseDuplicateOpenRecurring(householdId, { timeZone, now });

  // Missed prior-day opens → archive (cancelled), open only the current day slot.
  const rolled = await rollForwardMissedRecurringInstances({
    householdId,
    createdBy,
    timeZone,
    now,
  });

  const { data: templates } = await admin
    .from("recurring_task_templates")
    .select(
      "id, household_id, title, description, default_assignee_id, cadence, day_of_week, day_of_month, due_time, reliant_confirm_requested, is_active",
    )
    .eq("household_id", householdId)
    .eq("is_active", true);

  if (!templates?.length) {
    return rolled.spawned;
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

  let spawnedCount = rolled.spawned;

  for (const raw of templates) {
    const template = raw as TemplateRow;
    if (openTemplateIds.has(template.id)) {
      continue;
    }

    // Latest instance for this series (any status).
    const { data: latestAny } = await admin
      .from("tasks")
      .select("status, due_at, updated_at, provenance")
      .eq("household_id", householdId)
      .eq("recurring_template_id", template.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = latestAny as {
      status: string;
      due_at: string | null;
      updated_at: string;
      provenance?: { archiveReason?: string } | null;
    } | null;

    // User deleted the current open card (cancelled) → leave the series paused.
    // System-archived missed days (or cancelled with a prior-day due) still need today's slot.
    if (latest?.status === "cancelled") {
      const missedArchive =
        latest.provenance?.archiveReason === "missed_occurrence" ||
        isRecurringDueMissed(latest.due_at, timeZone, now);
      if (!missedArchive) {
        continue;
      }
      // Recover current day after a failed mid-roll or missed archive without spawn.
      const dueAt = nextRecurringDueAt({
        cadence: template.cadence,
        dayOfWeek: template.day_of_week,
        dayOfMonth: template.day_of_month,
        dueTime: template.due_time,
        timeZone,
        now,
        includePastOnStartDay: true,
      });
      const spawnDueAt = template.due_time ? dueAt : null;
      if (template.due_time && !spawnDueAt) {
        continue;
      }
      if ((await countOpenForTemplate(admin, householdId, template.id)) > 0) {
        openTemplateIds.add(template.id);
        continue;
      }
      const recovered = await insertSpawnedTask({
        householdId,
        template,
        dueAt: spawnDueAt,
        createdBy,
      });
      if (recovered) {
        spawnedCount += 1;
        openTemplateIds.add(template.id);
      }
      continue;
    }
    if (latest && latest.status !== "done") {
      // Unexpected open status that wasn't in openTemplateIds — skip.
      continue;
    }

    // Cold start (no history): same as create — include today even if due time passed.
    // After a done instance: strictly after that due so we never re-open the same slot.
    // If that next slot is still a prior day (multi-day gap), roll-forward on next load
    // will archive and open today — but prefer jumping to current day when the
    // completed due is already before today.
    const completedWasMissed =
      latest?.due_at != null && isRecurringDueMissed(latest.due_at, timeZone, now);
    const after = latest
      ? completedWasMissed
        ? now
        : afterInstantForNextSpawn(latest.due_at, new Date(latest.updated_at))
      : now;

    const dueAt = nextRecurringDueAt({
      cadence: template.cadence,
      dayOfWeek: template.day_of_week,
      dayOfMonth: template.day_of_month,
      dueTime: template.due_time,
      timeZone,
      now: after,
      includePastOnStartDay: !latest || completedWasMissed,
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
