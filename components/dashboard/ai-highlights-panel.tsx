import { Suspense } from "react";

import { AiHighlightsCard } from "@/components/dashboard/ai-highlights-card";
import { AiHighlightsSkeleton } from "@/components/dashboard/ai-highlights-skeleton";
import { getAiHighlightsBundle } from "@/lib/ai/queries";

async function AiHighlightsContent({
  householdId,
  canRefresh,
}: {
  householdId: string;
  canRefresh: boolean;
}) {
  try {
    const { insights, lastGeneratedAt } = await getAiHighlightsBundle(householdId);
    return (
      <AiHighlightsCard
        insights={insights}
        lastGeneratedAt={lastGeneratedAt}
        canRefresh={canRefresh}
      />
    );
  } catch {
    return (
      <AiHighlightsCard
        insights={[]}
        canRefresh={canRefresh}
        error="Could not load highlights. Refresh the page to try again."
      />
    );
  }
}

export function AiHighlightsPanel({
  householdId,
  canRefresh = false,
}: {
  householdId: string;
  canRefresh?: boolean;
}) {
  return (
    <Suspense fallback={<AiHighlightsSkeleton />}>
      <AiHighlightsContent householdId={householdId} canRefresh={canRefresh} />
    </Suspense>
  );
}
