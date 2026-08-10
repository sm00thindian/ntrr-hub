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
  | "today";

export type NeedsAttentionItem = AgendaItem & {
  reason: AttentionReason;
  /** Lower = higher priority */
  rank: number;
};

const REASON_RANK: Record<AttentionReason, number> = {
  conflict: 0,
  overdue: 1,
  due_soon: 2,
  unassigned: 3,
  reliant: 4,
  in_progress: 5,
  today: 6,
};

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
  };
}

/**
 * Pure ranking for tests and server. `nowMs` injectable for determinism.
 * Conflicts are represented as synthetic items when conflictCount > 0.
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

  const activeTasks = params.tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );

  for (const task of activeTasks) {
    let reason: AttentionReason | null = null;

    if (task.dueAt && agendaSortTimeMs(task.dueAt) < nowMs) {
      reason = "overdue";
    } else if (
      task.dueAt &&
      agendaSortTimeMs(task.dueAt) - nowMs <= DUE_SOON_MS &&
      agendaSortTimeMs(task.dueAt) >= nowMs
    ) {
      reason = "due_soon";
    } else if (!task.assigneeId) {
      reason = "unassigned";
    } else if (task.reliantConfirmRequested) {
      reason = "reliant";
    } else if (task.status === "in_progress") {
      reason = "in_progress";
    } else if (
      task.dueAt &&
      agendaSortTimeMs(task.dueAt) >= agendaSortTimeMs(params.rangeStart) &&
      agendaSortTimeMs(task.dueAt) < nowMs + 24 * 60 * 60 * 1000
    ) {
      reason = "today";
    }

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
    const start = agendaSortTimeMs(event.sortAt);
    if (start < nowMs) {
      continue;
    }
    if (start - nowMs <= DUE_SOON_MS) {
      items.push({
        ...event,
        reason: "due_soon",
        rank: REASON_RANK.due_soon + 0.5,
      });
    }
  }

  items.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
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
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
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
    default:
      return "Attention";
  }
}
