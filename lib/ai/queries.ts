import {
  LEGACY_NEEDS_ATTENTION_DEDUPE_KEYS,
  type AiInsight,
  type InsightPayload,
  type InsightType,
} from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";

function mapInsight(row: {
  id: string;
  household_id: string;
  type: string;
  dedupe_key: string | null;
  payload: unknown;
  snoozed_until: string | null;
  created_at: string;
}): AiInsight {
  const payload = (row.payload ?? {}) as InsightPayload;

  return {
    id: row.id,
    householdId: row.household_id,
    type: row.type as InsightType,
    dedupeKey: row.dedupe_key,
    title: payload.title ?? row.type,
    body: payload.body ?? null,
    actionHref: payload.actionHref ?? null,
    severity: payload.severity ?? "info",
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
  };
}

function isDisplayableInsight(row: {
  type: string;
  dedupe_key: string | null;
  snoozed_until: string | null;
}): boolean {
  // Conflicts + simple overdue/unassigned lists live under Focus
  if (row.type === "conflict") {
    return false;
  }
  if (row.dedupe_key && LEGACY_NEEDS_ATTENTION_DEDUPE_KEYS.has(row.dedupe_key)) {
    return false;
  }
  if (row.snoozed_until && new Date(row.snoozed_until).getTime() > Date.now()) {
    return false;
  }
  return true;
}

export type AiHighlightsBundle = {
  insights: AiInsight[];
  /** Most recent agent write for this household (any insight row) */
  lastGeneratedAt: string | null;
};

export async function getActiveAiInsights(householdId: string): Promise<AiInsight[]> {
  const bundle = await getAiHighlightsBundle(householdId);
  return bundle.insights;
}

export async function getAiHighlightsBundle(householdId: string): Promise<AiHighlightsBundle> {
  const supabase = await createClient();

  const [{ data, error }, lastResult] = await Promise.all([
    supabase
      .from("ai_insights")
      .select("id, household_id, type, dedupe_key, payload, snoozed_until, created_at")
      .eq("household_id", householdId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("ai_insights")
      .select("created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastGeneratedAt =
    !lastResult.error && lastResult.data
      ? ((lastResult.data as { created_at: string }).created_at ?? null)
      : null;

  if (error || !data) {
    return { insights: [], lastGeneratedAt };
  }

  const insights = data
    .filter((row) =>
      isDisplayableInsight(row as { type: string; dedupe_key: string | null; snoozed_until: string | null }),
    )
    .slice(0, 8)
    .map((row) => mapInsight(row as Parameters<typeof mapInsight>[0]));

  return { insights, lastGeneratedAt };
}
