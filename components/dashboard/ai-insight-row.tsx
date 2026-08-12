"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { dismissAiInsight, snoozeAiInsight } from "@/lib/ai/actions";
import type { AiInsight } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function AiInsightRow({ insight }: { insight: AiInsight }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex h-full min-h-0 flex-col rounded-lg border px-3 py-2.5",
        insight.severity === "warning" ? "border-brand/30 bg-brand/5" : "bg-accent/30",
        pending && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug">{insight.title}</p>
        {insight.body ? (
          <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed sm:text-sm">
            {insight.body}
          </p>
        ) : null}
        {insight.actionHref ? (
          <Link
            href={insight.actionHref}
            className="text-brand inline-block text-xs font-medium hover:underline"
          >
            View details →
          </Link>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await dismissAiInsight(insight.id);
            })
          }
        >
          Dismiss
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await snoozeAiInsight(insight.id, 24);
            })
          }
        >
          Snooze 1d
        </Button>
      </div>
    </li>
  );
}