import type { AgendaItem } from "@/lib/dashboard/types";
import { agendaSortTimeMs } from "@/lib/datetime/timezone";
import type { Task } from "@/lib/tasks/types";

export type AttentionReason =
  | "conflict"
  | "overdue"
  | "due_soon"
  | "unassigned"
  | "reliant"
  | "in_progress"
  | "today"
  | "calendar"
  | "done";

export type NeedsAttentionItem = AgendaItem & {
  reason: AttentionReason;
  /** Lower = higher priority for exception ordering */
  rank: number;
};

/** @deprecated Alias — caregiver Focus Today rows */
export type FocusTodayItem = NeedsAttentionItem;

/** Abbreviated next-day row — orientation only, not a second triage list. */
export type TomorrowFocusItem = {
  id: string;
  kind: "task" | "event";
  title: string;
  sortAt: string;
  allDay?: boolean;
  href?: string;
  /** Plain-text assignee for caregiver Focus (e.g. "Noah - Dentist form") */
  assigneeLabel?: string | null;
};

export type FocusBoard = {
  /** Chronological household day: Hub tasks + shared calendars; conflicts/overdue first */
  today: NeedsAttentionItem[];
  tomorrow: TomorrowFocusItem[];
  /** Timed items beyond the tomorrow cap (for “+N more”). */
  tomorrowOverflow: number;
};

const REASON_RANK: Record<AttentionReason, number> = {
  conflict: 0,
  overdue: 1,
  due_soon: 2,
  unassigned: 3,
  reliant: 4,
  in_progress: 5,
  today: 6,
  calendar: 7,
  done: 8,
};

function inZonedDay(isoMs: number, rangeStart: string, rangeEnd: string) {
  const start = agendaSortTimeMs(rangeStart);
  const end = agendaSortTimeMs(rangeEnd);
  return Number.isFinite(isoMs) && isoMs >= start && isoMs < end;
}

/** Completed during the household day (or due today if completion timestamp is odd). */
export function isFocusDoneToday(
  task: Task,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (task.status !== "done") {
    return false;
  }
  const updatedMs = Date.parse(task.updatedAt);
  if (Number.isFinite(updatedMs) && inZonedDay(updatedMs, rangeStart, rangeEnd)) {
    return true;
  }
  if (task.dueAt) {
    return inZonedDay(agendaSortTimeMs(task.dueAt), rangeStart, rangeEnd);
  }
  return false;
}

const DUE_SOON_MS = 4 * 60 * 60 * 1000; // 4 hours

function taskToAgenda(task: Task, fallbackSortAt: string): AgendaItem {
  return {
    id: `task-${task.id}`,
    kind: "task",
    title: task.title,
    sortAt: task.dueAt ?? fallbackSortAt,
    source: task.provenance.source,
    status: task.status,
    href: "/tasks",
    reliantConfirmRequested: task.reliantConfirmRequested,
    entityId: task.id,
    assigneeLabel: task.assigneeLabel,
    assigneePersona: task.assigneePersona,
  };
}

function taskReason(task: Task, nowMs: number, rangeStart: string): AttentionReason | null {
  if (task.status === "done") {
    return "done";
  }
  if (task.status !== "todo" && task.status !== "in_progress") {
    return null;
  }

  if (task.dueAt && agendaSortTimeMs(task.dueAt) < nowMs) {
    return "overdue";
  }
  if (
    task.dueAt &&
    agendaSortTimeMs(task.dueAt) - nowMs <= DUE_SOON_MS &&
    agendaSortTimeMs(task.dueAt) >= nowMs
  ) {
    return "due_soon";
  }
  if (!task.assigneeId) {
    return "unassigned";
  }
  if (task.reliantConfirmRequested) {
    return "reliant";
  }
  if (task.status === "in_progress") {
    return "in_progress";
  }
  if (
    task.dueAt &&
    agendaSortTimeMs(task.dueAt) >= agendaSortTimeMs(rangeStart)
  ) {
    return "today";
  }
  // Undated open
  if (!task.dueAt) {
    return "today";
  }
  return "today";
}

/**
 * Hub task on caregiver Focus Today:
 * - open due today / overdue / undated
 * - completed today (green Done proof — does not vanish after mark Done)
 *
 * Does not include the next open recurring slot when it is already tomorrow —
 * that lives on Tasks / Upcoming so completing today's card is not replaced
 * by a look-alike open row.
 */
export function isTaskOnFocusToday(
  task: Task,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (task.status === "cancelled") {
    return false;
  }

  if (task.status === "done") {
    return isFocusDoneToday(task, rangeStart, rangeEnd);
  }

  if (task.status !== "todo" && task.status !== "in_progress") {
    return false;
  }

  if (!task.dueAt) {
    return true;
  }

  const dueMs = agendaSortTimeMs(task.dueAt);
  const endMs = agendaSortTimeMs(rangeEnd);
  // Overdue + due today only (not tomorrow's next occurrence)
  return dueMs < endMs;
}

/**
 * Caregiver Focus Today: household day board.
 * Order: conflicts → overdue → chronological (all-day events first).
 * Events must already be household-shared filtered by the caller.
 */
export function buildCaregiverFocusToday(params: {
  tasks: Task[];
  events: AgendaItem[];
  conflictCount: number;
  nowMs?: number;
  rangeStart: string;
  rangeEnd: string;
}): NeedsAttentionItem[] {
  const nowMs = params.nowMs ?? Date.now();
  const items: NeedsAttentionItem[] = [];

  if (params.conflictCount > 0) {
    items.push({
      id: "attention-conflicts",
      kind: "task",
      title:
        params.conflictCount === 1
          ? "1 sync conflict needs a decision"
          : `${params.conflictCount} sync conflicts need a decision`,
      sortAt: new Date(nowMs).toISOString(),
      source: "ntrr",
      href: "/conflicts",
      reason: "conflict",
      rank: REASON_RANK.conflict,
    });
  }

  for (const task of params.tasks) {
    if (!isTaskOnFocusToday(task, params.rangeStart, params.rangeEnd)) {
      continue;
    }
    const reason = taskReason(task, nowMs, params.rangeStart);
    if (!reason) {
      continue;
    }
    items.push({
      ...taskToAgenda(task, params.rangeStart),
      reason,
      rank: REASON_RANK[reason],
    });
  }

  for (const event of params.events) {
    if (event.kind !== "event") {
      continue;
    }
    items.push({
      ...event,
      reason: "calendar",
      rank: REASON_RANK.calendar,
    });
  }

  items.sort((a, b) => {
    // Conflicts always first
    if (a.reason === "conflict" && b.reason !== "conflict") return -1;
    if (b.reason === "conflict" && a.reason !== "conflict") return 1;

    // Completed today sinks to the bottom (progress proof, not triage)
    const aDone = a.reason === "done" || a.status === "done" ? 1 : 0;
    const bDone = b.reason === "done" || b.status === "done" ? 1 : 0;
    if (aDone !== bDone) {
      return aDone - bDone;
    }

    // Then all overdue tasks before the rest of the day
    const aOverdue = a.reason === "overdue" ? 0 : 1;
    const bOverdue = b.reason === "overdue" ? 0 : 1;
    if (aOverdue !== bOverdue) {
      return aOverdue - bOverdue;
    }

    // Chronological body: all-day events first among non-overdue block
    if (a.reason !== "overdue" && b.reason !== "overdue") {
      const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
      const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
      if (aAllDay !== bAllDay) {
        return aAllDay - bAllDay;
      }
    }

    const timeDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.title.localeCompare(b.title);
  });

  const seen = new Set<string>();
  const unique: NeedsAttentionItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

/**
 * @deprecated Prefer buildCaregiverFocusToday for the day board.
 * Kept for unit tests of pure urgency ranking.
 */
export function rankNeedsAttention(params: {
  tasks: Task[];
  events: AgendaItem[];
  conflictCount: number;
  nowMs?: number;
  rangeStart: string;
  limit?: number;
}): NeedsAttentionItem[] {
  const nowMs = params.nowMs ?? Date.now();
  const limit = params.limit ?? 6;
  const rangeEnd = new Date(agendaSortTimeMs(params.rangeStart) + 24 * 60 * 60 * 1000).toISOString();
  const full = buildCaregiverFocusToday({
    tasks: params.tasks,
    // Old ranking only included soon events; pass empty for pure task tests
    events: params.events.filter((e) => {
      if (e.kind !== "event") return false;
      const start = agendaSortTimeMs(e.sortAt);
      return start >= nowMs && start - nowMs <= DUE_SOON_MS;
    }),
    conflictCount: params.conflictCount,
    nowMs,
    rangeStart: params.rangeStart,
    rangeEnd,
  });
  return full.slice(0, limit);
}

/**
 * Non-recurring tasks due on the next household day — out-of-the-ordinary only.
 * Daily recurring care stays off this list for schedule-sensitive calm.
 */
export function rankTomorrowPreview(params: {
  tasks: Task[];
  /** @deprecated Ignored — tomorrow Focus is tasks-only (non-recurring). */
  events?: AgendaItem[];
  rangeStart: string;
  rangeEnd: string;
  limit?: number;
}): { items: TomorrowFocusItem[]; overflow: number } {
  const limit = params.limit ?? 3;
  const startMs = agendaSortTimeMs(params.rangeStart);
  const endMs = agendaSortTimeMs(params.rangeEnd);
  const items: TomorrowFocusItem[] = [];

  for (const task of params.tasks) {
    if (task.status === "done" || task.status === "cancelled") {
      continue;
    }
    if (task.recurringTemplateId) {
      continue;
    }
    if (!task.dueAt) {
      continue;
    }
    const dueMs = agendaSortTimeMs(task.dueAt);
    if (dueMs < startMs || dueMs >= endMs) {
      continue;
    }
    items.push({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title,
      sortAt: task.dueAt,
      href: "/tasks",
      assigneeLabel: task.assigneeLabel,
    });
  }

  items.sort((a, b) => {
    const timeDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.title.localeCompare(b.title);
  });

  const overflow = Math.max(0, items.length - limit);
  return { items: items.slice(0, limit), overflow };
}

export function attentionReasonLabel(reason: AttentionReason): string {
  switch (reason) {
    case "conflict":
      return "Needs decision";
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "unassigned":
      return "Unassigned";
    case "reliant":
      return "Phone confirm";
    case "in_progress":
      return "In progress";
    case "today":
      return "Due today";
    case "calendar":
      return "Calendar";
    case "done":
      return "Done";
    default:
      return "Focus";
  }
}
