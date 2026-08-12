import { dismissInsightByDedupe, upsertInsight } from "@/lib/ai/insights";
import { memberDisplayLabel } from "@/lib/households/member-label";
import { createAdminClient } from "@/lib/supabase/admin";

const UNASSIGNED_KEY = "unassigned-tasks";
const OVERDUE_KEY = "overdue-tasks";
const RELIANT_PHONE_KEY = "reliant-missing-phone";

/**
 * Pattern-level reminders — not a second copy of Needs attention line items.
 * - Multi-item overdue per person (workload)
 * - Reliant-flagged tasks with no call-target mobile
 * Legacy unassigned/overdue summary cards are dismissed.
 */
export async function runReminderSuggesterAgent(householdId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Clean legacy cards that duplicated Needs attention
  await Promise.all([
    dismissInsightByDedupe(householdId, "reminder", UNASSIGNED_KEY),
    dismissInsightByDedupe(householdId, "reminder", OVERDUE_KEY),
  ]);

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, assignee_id, due_at, status, reliant_confirm_requested")
    .eq("household_id", householdId)
    .in("status", ["todo", "in_progress"]);

  type TaskRow = {
    id: string;
    title: string;
    assignee_id: string | null;
    due_at: string | null;
    status: string;
    reliant_confirm_requested?: boolean | null;
  };

  const active = (tasks as unknown as TaskRow[] | null) ?? [];
  const overdue = active.filter((task) => task.due_at && task.due_at < now);

  const { data: members } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);

  const userIds = (members ?? []).map((m) => (m as { user_id: string }).user_id);

  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, display_name, phone_e164").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string; display_name: string | null; phone_e164: string | null }> };

  const profileById = new Map(
    (profiles ?? []).map((p) => {
      const row = p as {
        id: string;
        email: string;
        display_name: string | null;
        phone_e164: string | null;
      };
      return [row.id, row] as const;
    }),
  );

  // —— Workload: 2+ overdue for the same assignee (named, not a global count) ——
  const overdueByAssignee = new Map<string, typeof overdue>();
  for (const task of overdue) {
    const assigneeId = task.assignee_id as string | null;
    if (!assigneeId) {
      continue;
    }
    const list = overdueByAssignee.get(assigneeId) ?? [];
    list.push(task);
    overdueByAssignee.set(assigneeId, list);
  }

  const activeWorkloadKeys = new Set<string>();
  let workloadCreated = 0;

  for (const [assigneeId, list] of overdueByAssignee) {
    const dedupeKey = `workload-${assigneeId}`;
    if (list.length < 2) {
      await dismissInsightByDedupe(householdId, "workload", dedupeKey);
      continue;
    }

    activeWorkloadKeys.add(dedupeKey);
    const profile = profileById.get(assigneeId);
    const name = memberDisplayLabel(profile?.email, profile?.display_name);
    const sample = list
      .slice(0, 2)
      .map((t) => `"${t.title}"`)
      .join(", ");
    const more = list.length > 2 ? ` and ${list.length - 2} more` : "";

    await upsertInsight({
      householdId,
      type: "workload",
      dedupeKey,
      payload: {
        title: `${name} has ${list.length} overdue tasks`,
        body: `${sample}${more}. Needs attention lists each item; this is the pattern.`,
        actionHref: "/tasks",
        severity: "warning",
      },
    });
    workloadCreated += 1;
  }

  // Dismiss workload cards for assignees who no longer qualify
  const { data: existingWorkload } = await admin
    .from("ai_insights")
    .select("dedupe_key")
    .eq("household_id", householdId)
    .eq("type", "workload")
    .like("dedupe_key", "workload-%")
    .is("dismissed_at", null);

  for (const row of existingWorkload ?? []) {
    const key = row.dedupe_key as string | null;
    if (key && !activeWorkloadKeys.has(key)) {
      await dismissInsightByDedupe(householdId, "workload", key);
    }
  }

  // —— Reliant hygiene: confirm requested but no mobile on assignee ——
  const reliantMissingPhone = active.filter((task) => {
    if (!task.reliant_confirm_requested) {
      return false;
    }
    const assigneeId = task.assignee_id as string | null;
    if (!assigneeId) {
      return true;
    }
    const phone = profileById.get(assigneeId)?.phone_e164;
    return !phone?.trim();
  });

  if (reliantMissingPhone.length === 0) {
    await dismissInsightByDedupe(householdId, "hygiene", RELIANT_PHONE_KEY);
  } else {
    const sample = reliantMissingPhone[0]?.title;
    await upsertInsight({
      householdId,
      type: "hygiene",
      dedupeKey: RELIANT_PHONE_KEY,
      payload: {
        title:
          reliantMissingPhone.length === 1
            ? "Reliant task has no call-target mobile"
            : `${reliantMissingPhone.length} Reliant tasks need a mobile`,
        body:
          reliantMissingPhone.length === 1
            ? `"${sample}" is marked for phone confirmation, but the assignee has no mobile on file. Add one on Family or Settings.`
            : "Some tasks request Reliant confirmation without a reachable mobile. Set call targets on Family → Edit.",
        actionHref: "/family",
        severity: "info",
      },
    });
  }

  return {
    workload: workloadCreated,
    reliantMissingPhone: reliantMissingPhone.length,
    overdue: overdue.length,
  };
}
