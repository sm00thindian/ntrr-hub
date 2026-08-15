"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle } from "lucide-react";

import { TomorrowPreview } from "@/components/dashboard/tomorrow-preview";
import { ReliantConfirmChip } from "@/components/family/role-badge";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TomorrowFocusItem } from "@/lib/dashboard/needs-attention";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  agendaSortTimeMs,
  formatTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { updateTaskStatus } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

type MyDayPanelProps = {
  items: AgendaItem[];
  tomorrow?: TomorrowFocusItem[];
  tomorrowOverflow?: number;
  timeZone?: string;
  canCompleteTasks?: boolean;
  householdName: string;
};

function timeLabel(item: AgendaItem, zone: string, nowMs: number) {
  if (item.kind === "event") {
    if (item.allDay) {
      return "All day";
    }
    return formatTimeInZone(item.sortAt, zone);
  }

  if (item.status === "done") {
    return "Completed";
  }

  if (!item.sortAt || agendaSortTimeMs(item.sortAt) === Number.POSITIVE_INFINITY) {
    return "No due time";
  }

  const dueMs = agendaSortTimeMs(item.sortAt);
  if (dueMs < nowMs) {
    return `Overdue · was ${formatTimeInZone(item.sortAt, zone)}`;
  }

  return `Due ${formatTimeInZone(item.sortAt, zone)}`;
}

/**
 * Self-advocate home: only their day — tasks assigned to them and calendars labeled as theirs.
 * Completed tasks stay visible for the day with a clear green Done state.
 */
export function MyDayPanel({
  items,
  tomorrow = [],
  tomorrowOverflow = 0,
  timeZone,
  canCompleteTasks = true,
  householdName,
}: MyDayPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [optimisticDoneIds, setOptimisticDoneIds] = useState<Set<string>>(() => new Set());
  const inflightDoneIds = useRef(new Set<string>());
  const nowMs = Date.now();

  useEffect(() => {
    setOptimisticDoneIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        const item = items.find((i) => i.entityId === id);
        if (!item) {
          changed = true;
          continue;
        }
        if (item.status === "done") {
          changed = true;
          continue;
        }
        if (item.status === "todo" || item.status === "in_progress") {
          if (inflightDoneIds.current.has(id)) {
            next.add(id);
          } else {
            changed = true;
          }
          continue;
        }
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

  function isTaskDone(item: (typeof items)[number]) {
    if (item.kind !== "task") {
      return false;
    }
    if (item.status === "done") {
      return true;
    }
    if (item.status === "todo" || item.status === "in_progress") {
      return Boolean(item.entityId && optimisticDoneIds.has(item.entityId));
    }
    return false;
  }

  const openCount = items.filter((i) => i.kind === "task" && !isTaskDone(i)).length;
  const doneCount = items.filter((i) => isTaskDone(i)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My day</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {householdName} · your tasks and appointments
          {doneCount > 0 ? (
            <span className="text-brand">
              {" "}
              · {doneCount} done
              {openCount > 0 ? ` · ${openCount} left` : ""}
            </span>
          ) : null}
        </p>
      </div>

      <Card className="border-brand/20">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            What you need to do. Tap <span className="text-foreground font-medium">Done</span> when
            finished — it turns green so you can see your progress. Items marked{" "}
            <span className="text-foreground font-medium">Reliant</span> may get a phone
            confirmation call. Tomorrow shows what&apos;s outside the usual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.length ? (
            <ul className="space-y-1">
              {items.map((item) => {
                const isTask = item.kind === "task";
                const isDone = isTaskDone(item);
                const overdue =
                  isTask &&
                  !isDone &&
                  item.sortAt &&
                  agendaSortTimeMs(item.sortAt) < nowMs;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-2 py-3 transition-colors",
                      isDone
                        ? "border-brand/25 bg-brand/5"
                        : "border-transparent hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        isDone
                          ? "bg-brand text-brand-foreground"
                          : isTask
                            ? "bg-muted text-muted-foreground"
                            : "bg-brand/10 text-brand",
                      )}
                      aria-hidden
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" />
                      ) : isTask ? (
                        <Circle className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4 fill-current opacity-20" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p
                          className={cn(
                            "text-base font-medium leading-snug",
                            isDone && "text-muted-foreground line-through decoration-brand/50",
                          )}
                        >
                          {item.title}
                        </p>
                        {item.reliantConfirmRequested && !isDone ? (
                          <ReliantConfirmChip />
                        ) : null}
                        {isDone ? (
                          <span className="bg-brand/15 text-brand rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Done
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={
                          overdue
                            ? "text-destructive mt-0.5 text-sm"
                            : isDone
                              ? "text-brand/80 mt-0.5 text-sm"
                              : "text-muted-foreground mt-0.5 text-sm"
                        }
                      >
                        {isTask ? "Task" : "Calendar"} · {timeLabel(item, zone, nowMs)}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                    {isTask && canCompleteTasks && item.entityId ? (
                      <TaskDoneControl
                        title={item.title}
                        done={isDone}
                        pending={pending}
                        className="mt-0.5"
                        onMarkDone={() => {
                          const taskId = item.entityId!;
                          setActionError(null);
                          inflightDoneIds.current.add(taskId);
                          setOptimisticDoneIds((prev) => new Set(prev).add(taskId));
                          startTransition(async () => {
                            const result = await updateTaskStatus(taskId, "done");
                            inflightDoneIds.current.delete(taskId);
                            if (result?.error) {
                              setOptimisticDoneIds((prev) => {
                                const next = new Set(prev);
                                next.delete(taskId);
                                return next;
                              });
                              setActionError(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                        onReopen={() => {
                          const taskId = item.entityId!;
                          setActionError(null);
                          inflightDoneIds.current.delete(taskId);
                          setOptimisticDoneIds((prev) => {
                            const next = new Set(prev);
                            next.delete(taskId);
                            return next;
                          });
                          startTransition(async () => {
                            const result = await updateTaskStatus(taskId, "todo");
                            if (result?.error) {
                              setActionError(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nothing on your day yet. When someone assigns you a task or links your calendar,
              it will show up here.
            </p>
          )}
          {actionError ? (
            <p className="text-destructive mt-3 text-sm" role="alert">
              {actionError}
            </p>
          ) : null}

          <TomorrowPreview
            items={tomorrow}
            overflow={tomorrowOverflow}
            timeZone={zone}
            headingId="my-day-tomorrow-heading"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link href="/tasks">My tasks</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link href="/calendar">Calendar</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="min-h-10">
          <Link href="/settings">My phone & profile</Link>
        </Button>
      </div>
    </div>
  );
}
