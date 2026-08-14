"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { AiInsightRow } from "@/components/dashboard/ai-insight-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { refreshHouseholdHighlights } from "@/lib/ai/actions";
import type { AiInsight } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type AiHighlightsCardProps = {
  insights: AiInsight[];
  lastGeneratedAt?: string | null;
  canRefresh?: boolean;
  error?: string | null;
};

function formatLastGenerated(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return null;
  }
  const delta = Date.now() - ms;
  if (delta < 60_000) {
    return "just now";
  }
  if (delta < 60 * 60_000) {
    return `${Math.floor(delta / 60_000)}m ago`;
  }
  if (delta < 24 * 60 * 60_000) {
    return `${Math.floor(delta / (60 * 60_000))}h ago`;
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function AiHighlightsCard({
  insights,
  lastGeneratedAt,
  canRefresh = false,
  error,
}: AiHighlightsCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lastLabel = formatLastGenerated(lastGeneratedAt);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Highlights</CardTitle>
          <CardDescription>
            Schedule patterns and household suggestions from simple rules — not automated actions.
            Item-level overdue and conflicts stay under Focus.
          </CardDescription>
          {lastLabel ? (
            <p className="text-muted-foreground text-xs">Last refresh · {lastLabel}</p>
          ) : null}
        </div>
        {canRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await refreshHouseholdHighlights();
                router.refresh();
              })
            }
          >
            <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
            {pending ? "Refreshing…" : "Refresh"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {insights.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <AiInsightRow key={insight.id} insight={insight} />
            ))}
          </ul>
        ) : !error ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>No pattern highlights right now.</p>
            <p className="text-xs leading-relaxed">
              Overlaps, multi-task workloads, and Reliant phone gaps appear here after sync or a
              refresh. Day-to-day overdue and conflicts are listed under Focus.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
