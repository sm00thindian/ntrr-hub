"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { ReliantConfirmChip } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  attentionReasonLabel,
  type NeedsAttentionItem,
} from "@/lib/dashboard/needs-attention";
import { formatTimeInZone, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { updateTaskStatus } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

type NeedsAttentionPanelProps = {
  items: NeedsAttentionItem[];
  timeZone?: string;
  canCompleteTasks?: boolean;
};

export function NeedsAttentionPanel({
  items,
  timeZone,
  canCompleteTasks = true,
}: NeedsAttentionPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription className="line-clamp-2 sm:line-clamp-none">
          Overdue, unassigned, conflicts, and what is due soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="relative space-y-0">
            {items.map((item, index) => {
              const isTask = item.kind === "task" && item.reason !== "conflict";
              const isConflict = item.reason === "conflict";
              const timeLabel = isConflict
                ? "Review"
                : item.kind === "event"
                  ? item.allDay
                    ? "All day"
                    : formatTimeInZone(item.sortAt, zone)
                  : item.sortAt && item.reason !== "unassigned"
                    ? `Due ${formatTimeInZone(item.sortAt, zone)}`
                    : item.reason === "unassigned"
                      ? "No owner"
                      : "No due time";

              return (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < items.length - 1 ? (
                    <span
                      className={cn(
                        "absolute top-3 left-[5px] h-[calc(100%-4px)] w-0.5",
                        item.reason === "overdue" || item.reason === "conflict"
                          ? "bg-destructive/60"
                          : "bg-brand",
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      item.reason === "overdue" || item.reason === "conflict"
                        ? "bg-destructive"
                        : "bg-brand",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium">{item.title}</p>
                      )}
                      {item.reliantConfirmRequested ? <ReliantConfirmChip /> : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      <span className="font-medium text-foreground/80">
                        {attentionReasonLabel(item.reason)}
                      </span>
                      {" · "}
                      {timeLabel}
                    </p>
                  </div>
                  {isConflict && item.href ? (
                    <Button asChild size="sm" variant="outline" className="mt-0.5 shrink-0">
                      <Link href={item.href}>Resolve</Link>
                    </Button>
                  ) : null}
                  {isTask &&
                  canCompleteTasks &&
                  item.entityId &&
                  item.status !== "done" &&
                  item.reason !== "conflict" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-0.5 shrink-0"
                      disabled={pending}
                      aria-label={`Mark ${item.title} done`}
                      onClick={() => {
                        const taskId = item.entityId!;
                        startTransition(async () => {
                          await updateTaskStatus(taskId, "done");
                          router.refresh();
                        });
                      }}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Done
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing urgent. Add Hub tasks or connect calendars in Settings for today&apos;s context.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
