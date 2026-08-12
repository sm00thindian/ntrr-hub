"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { AssigneeChip, ReliantConfirmChip } from "@/components/family/role-badge";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
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

/** Brief hold so the green Done state is visible before the row leaves the list. */
const DONE_FEEDBACK_MS = 900;

export function NeedsAttentionPanel({
  items,
  timeZone,
  canCompleteTasks = true,
}: NeedsAttentionPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** Task entity ids marked done this session — show solid green until refresh drops them. */
  const [justDoneIds, setJustDoneIds] = useState<Set<string>>(() => new Set());

  // Drop local done markers once the server list no longer includes those tasks
  useEffect(() => {
    const liveIds = new Set(
      items.map((i) => i.entityId).filter((id): id is string => Boolean(id)),
    );
    setJustDoneIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (liveIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription className="line-clamp-2 sm:line-clamp-none">
          Overdue, unassigned, conflicts, and what is due soon. Done turns green, then the item
          leaves this list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="relative space-y-0">
            {items.map((item, index) => {
              const isTask = item.kind === "task" && item.reason !== "conflict";
              const isConflict = item.reason === "conflict";
              const isJustDone = Boolean(
                item.entityId && justDoneIds.has(item.entityId),
              );
              const isDone = item.status === "done" || isJustDone;

              const timeLabel = isConflict
                ? "Review"
                : isDone
                  ? "Completed"
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
                <li
                  key={item.id}
                  className={cn(
                    "relative flex gap-3 pb-4 last:pb-0",
                    isDone && "opacity-95",
                  )}
                >
                  {index < items.length - 1 ? (
                    <span
                      className={cn(
                        "absolute top-3 left-[5px] h-[calc(100%-4px)] w-0.5",
                        isDone
                          ? "bg-brand/50"
                          : item.reason === "overdue" || item.reason === "conflict"
                            ? "bg-destructive/60"
                            : "bg-brand",
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full",
                      isDone
                        ? "h-4 w-4 bg-brand text-brand-foreground"
                        : item.reason === "overdue" || item.reason === "conflict"
                          ? "bg-destructive"
                          : "bg-brand",
                    )}
                    aria-hidden="true"
                  >
                    {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.href && !isDone ? (
                        <Link
                          href={item.href}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            isDone &&
                              "text-muted-foreground line-through decoration-brand/50",
                          )}
                        >
                          {item.title}
                        </p>
                      )}
                      {item.reliantConfirmRequested && !isDone ? (
                        <ReliantConfirmChip />
                      ) : null}
                      {isDone ? (
                        <span className="bg-brand/15 text-brand rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          Done
                        </span>
                      ) : null}
                      {item.kind === "task" && item.reason !== "conflict" && !isDone ? (
                        <AssigneeChip
                          label={item.assigneeLabel}
                          persona={item.assigneePersona}
                          unassigned={!item.assigneeLabel}
                        />
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        "text-xs",
                        isDone ? "text-brand/80" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "font-medium",
                          isDone ? "text-brand" : "text-foreground/80",
                        )}
                      >
                        {isDone ? "Done" : attentionReasonLabel(item.reason)}
                      </span>
                      {" · "}
                      {timeLabel}
                    </p>
                  </div>
                  {isConflict && item.href && !isDone ? (
                    <Button asChild size="sm" variant="outline" className="mt-0.5 shrink-0">
                      <Link href={item.href}>Resolve</Link>
                    </Button>
                  ) : null}
                  {isTask && canCompleteTasks && item.entityId && item.reason !== "conflict" ? (
                    <TaskDoneControl
                      title={item.title}
                      done={isDone}
                      pending={pending && !isDone}
                      className="mt-0.5"
                      onMarkDone={() => {
                        const taskId = item.entityId!;
                        setJustDoneIds((prev) => new Set(prev).add(taskId));
                        startTransition(async () => {
                          await updateTaskStatus(taskId, "done");
                          // Let the solid green state register before the list re-fetches
                          window.setTimeout(() => {
                            router.refresh();
                          }, DONE_FEEDBACK_MS);
                        });
                      }}
                      onReopen={
                        isDone
                          ? () => {
                              const taskId = item.entityId!;
                              setJustDoneIds((prev) => {
                                const next = new Set(prev);
                                next.delete(taskId);
                                return next;
                              });
                              startTransition(async () => {
                                await updateTaskStatus(taskId, "todo");
                                router.refresh();
                              });
                            }
                          : undefined
                      }
                    />
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
