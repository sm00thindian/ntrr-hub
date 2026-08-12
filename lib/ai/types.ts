export type InsightType =
  | "conflict"
  | "reminder"
  | "schedule"
  | "workload"
  | "hygiene";

export type InsightSeverity = "info" | "warning";

export type InsightPayload = {
  title: string;
  body?: string;
  actionHref?: string;
  severity?: InsightSeverity;
};

export type AiInsight = {
  id: string;
  householdId: string;
  type: InsightType;
  dedupeKey: string | null;
  title: string;
  body: string | null;
  actionHref: string | null;
  severity: InsightSeverity;
  snoozedUntil: string | null;
  createdAt: string;
};

export type AgentRunMode = "post-sync" | "daily";

/** Legacy keys that duplicate Needs attention — never show in Highlights. */
export const LEGACY_NEEDS_ATTENTION_DEDUPE_KEYS = new Set([
  "pending-conflicts",
  "unassigned-tasks",
  "overdue-tasks",
]);
