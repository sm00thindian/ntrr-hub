import { dismissInsightByDedupe } from "@/lib/ai/insights";
import { getPendingConflictCount } from "@/lib/sync/conflict";

const DEDUPE_KEY = "pending-conflicts";

/**
 * Conflicts already appear in Needs attention + the app header badge.
 * This agent no longer creates AI insight cards — it only cleans legacy rows
 * so Highlights stays de-duplicated.
 */
export async function runConflictDetectorAgent(householdId: string) {
  const count = await getPendingConflictCount(householdId);

  // Drop any leftover conflict cards from earlier M5 behavior
  await dismissInsightByDedupe(householdId, "conflict", DEDUPE_KEY);

  return {
    created: false,
    count,
    deferredToNeedsAttention: true as const,
  };
}
