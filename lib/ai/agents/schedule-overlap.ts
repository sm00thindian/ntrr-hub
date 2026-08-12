import { dismissInsightByDedupe, upsertInsight } from "@/lib/ai/insights";
import type { GoogleCalendarAssignment } from "@/lib/calendar/colors";
import { resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { Provenance } from "@/lib/provenance/types";
import { createAdminClient } from "@/lib/supabase/admin";

type CalendarRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  provenance: Provenance | null;
  memberUserId: string | null;
};

type OverlapCandidate = {
  key: string;
  left: CalendarRow;
  right: CalendarRow;
  samePerson: boolean;
  memberUserId: string | null;
  startMs: number;
};

const MAX_OVERLAP_INSIGHTS = 4;
const MAX_HANDOFF_INSIGHTS = 2;

function overlapKey(idA: string, idB: string) {
  return [idA, idB].sort().join(":");
}

function rangesOverlap(a: CalendarRow, b: CalendarRow) {
  if (a.all_day || b.all_day) {
    const aDay = a.starts_at.slice(0, 10);
    const bDay = b.starts_at.slice(0, 10);
    return aDay === bDay;
  }

  const aStart = new Date(a.starts_at).getTime();
  const aEnd = new Date(a.ends_at).getTime();
  const bStart = new Date(b.starts_at).getTime();
  const bEnd = new Date(b.ends_at).getTime();

  return aStart < bEnd && bStart < aEnd;
}

function formatStartLabel(iso: string, allDay: boolean, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: allDay ? undefined : "numeric",
    minute: allDay ? undefined : "2-digit",
    timeZone,
  });
}

function resolveMemberForEvent(
  provenance: Provenance | null | undefined,
  googleCalendars: Record<string, GoogleCalendarAssignment> | undefined,
): string | null {
  const calendarId = provenance?.calendarId;
  if (!calendarId || !googleCalendars) {
    return null;
  }
  return googleCalendars[calendarId]?.memberUserId ?? null;
}

function pointInRange(ms: number, startIso: string, endIso: string, allDay: boolean) {
  if (allDay) {
    // Treat all-day as blocking the whole local calendar day is hard without zone day bounds;
    // use UTC date of starts_at for a simple same-day check against task due date string.
    return false;
  }
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return ms >= start && ms < end;
}

/**
 * Schedule patterns for Highlights:
 * 1) Same-person double-book (via Google calendar → member assignment)
 * 2) Generic event overlaps (capped)
 * 3) Handoff gaps: task due while assignee has a timed calendar event
 * Labels use household timezone.
 */
export async function runScheduleOverlapAgent(householdId: string) {
  const admin = createAdminClient();
  const settings = await getHouseholdCalendarSettings(householdId);
  const timeZone = resolveHouseholdTimeZone(settings.timezone);
  const googleCalendars = settings.googleCalendars;

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 7);

  const { data: events } = await admin
    .from("calendar_events")
    .select("id, title, starts_at, ends_at, all_day, provenance")
    .eq("household_id", householdId)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString())
    .order("starts_at", { ascending: true });

  const rows: CalendarRow[] = ((events ?? []) as Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    provenance: Provenance | null;
  }>).map((row) => ({
    ...row,
    memberUserId: resolveMemberForEvent(row.provenance, googleCalendars),
  }));

  const candidates: OverlapCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i];
      const right = rows[j];
      if (!left || !right || !rangesOverlap(left, right)) {
        continue;
      }

      const key = overlapKey(left.id, right.id);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const samePerson = Boolean(
        left.memberUserId && right.memberUserId && left.memberUserId === right.memberUserId,
      );

      candidates.push({
        key,
        left,
        right,
        samePerson,
        memberUserId: samePerson ? left.memberUserId : null,
        startMs: Math.min(
          new Date(left.starts_at).getTime(),
          new Date(right.starts_at).getTime(),
        ),
      });
    }
  }

  // Prefer same-person double-books, then soonest
  candidates.sort((a, b) => {
    if (a.samePerson !== b.samePerson) {
      return a.samePerson ? -1 : 1;
    }
    return a.startMs - b.startMs;
  });

  const selected = candidates.slice(0, MAX_OVERLAP_INSIGHTS);
  const activeKeys = new Set(selected.map((c) => `overlap-${c.key}`));

  // Member labels for same-person copy
  const memberIds = [
    ...new Set(selected.map((c) => c.memberUserId).filter((id): id is string => Boolean(id))),
  ];
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, email, display_name").in("id", memberIds)
    : { data: [] as Array<{ id: string; email: string; display_name: string | null }> };
  const nameById = new Map(
    (profiles ?? []).map((p) => {
      const row = p as { id: string; email: string; display_name: string | null };
      return [row.id, memberDisplayLabel(row.email, row.display_name)] as const;
    }),
  );

  let overlapsCreated = 0;
  for (const candidate of selected) {
    const startLabel = formatStartLabel(
      candidate.left.starts_at,
      candidate.left.all_day || candidate.right.all_day,
      timeZone,
    );
    const dedupeKey = `overlap-${candidate.key}`;

    if (candidate.samePerson && candidate.memberUserId) {
      const name = nameById.get(candidate.memberUserId) ?? "Someone";
      await upsertInsight({
        householdId,
        type: "schedule",
        dedupeKey,
        payload: {
          title: `${name} may be double-booked`,
          body: `"${candidate.left.title}" and "${candidate.right.title}" overlap on ${startLabel}.`,
          actionHref: "/calendar",
          severity: "warning",
        },
      });
    } else {
      await upsertInsight({
        householdId,
        type: "schedule",
        dedupeKey,
        payload: {
          title: "Schedule overlap",
          body: `"${candidate.left.title}" and "${candidate.right.title}" overlap on ${startLabel}.`,
          actionHref: "/calendar",
          severity: "warning",
        },
      });
    }
    overlapsCreated += 1;
  }

  // Dismiss stale overlaps
  const { data: existingScheduleInsights } = await admin
    .from("ai_insights")
    .select("dedupe_key")
    .eq("household_id", householdId)
    .eq("type", "schedule")
    .like("dedupe_key", "overlap-%")
    .is("dismissed_at", null);

  for (const row of existingScheduleInsights ?? []) {
    const dedupeKey = row.dedupe_key as string | null;
    if (dedupeKey && !activeKeys.has(dedupeKey)) {
      await dismissInsightByDedupe(householdId, "schedule", dedupeKey);
    }
  }

  // —— Handoff gaps: open task due during assignee's timed event ——
  const { data: openTasks } = await admin
    .from("tasks")
    .select("id, title, assignee_id, due_at, status")
    .eq("household_id", householdId)
    .in("status", ["todo", "in_progress"])
    .not("due_at", "is", null)
    .not("assignee_id", "is", null)
    .gte("due_at", rangeStart.toISOString())
    .lt("due_at", rangeEnd.toISOString());

  const handoffCandidates: Array<{
    key: string;
    taskTitle: string;
    eventTitle: string;
    dueLabel: string;
    name: string;
  }> = [];

  for (const task of openTasks ?? []) {
    const assigneeId = task.assignee_id as string;
    const dueAt = task.due_at as string;
    const dueMs = new Date(dueAt).getTime();
    if (!Number.isFinite(dueMs)) {
      continue;
    }

    for (const event of rows) {
      if (event.memberUserId !== assigneeId) {
        continue;
      }
      if (!pointInRange(dueMs, event.starts_at, event.ends_at, event.all_day)) {
        continue;
      }

      const key = `handoff-${task.id}-${event.id}`;
      const profileName =
        nameById.get(assigneeId) ??
        (await (async () => {
          const { data } = await admin
            .from("profiles")
            .select("email, display_name")
            .eq("id", assigneeId)
            .maybeSingle();
          const row = data as { email?: string; display_name?: string | null } | null;
          const label = memberDisplayLabel(row?.email, row?.display_name);
          nameById.set(assigneeId, label);
          return label;
        })());

      handoffCandidates.push({
        key,
        taskTitle: task.title as string,
        eventTitle: event.title,
        dueLabel: formatStartLabel(dueAt, false, timeZone),
        name: profileName,
      });
    }
  }

  handoffCandidates.sort((a, b) => a.dueLabel.localeCompare(b.dueLabel));
  const handoffSelected = handoffCandidates.slice(0, MAX_HANDOFF_INSIGHTS);
  const activeHandoffKeys = new Set(handoffSelected.map((h) => h.key));

  for (const handoff of handoffSelected) {
    await upsertInsight({
      householdId,
      type: "schedule",
      dedupeKey: handoff.key,
      payload: {
        title: `Handoff risk for ${handoff.name}`,
        body: `Task "${handoff.taskTitle}" is due ${handoff.dueLabel} while "${handoff.eventTitle}" is on their calendar.`,
        actionHref: "/tasks",
        severity: "info",
      },
    });
  }

  const { data: existingHandoffs } = await admin
    .from("ai_insights")
    .select("dedupe_key")
    .eq("household_id", householdId)
    .eq("type", "schedule")
    .like("dedupe_key", "handoff-%")
    .is("dismissed_at", null);

  for (const row of existingHandoffs ?? []) {
    const dedupeKey = row.dedupe_key as string | null;
    if (dedupeKey && !activeHandoffKeys.has(dedupeKey)) {
      await dismissInsightByDedupe(householdId, "schedule", dedupeKey);
    }
  }

  return {
    overlaps: overlapsCreated,
    handoffs: handoffSelected.length,
    candidates: candidates.length,
    timeZone,
  };
}
