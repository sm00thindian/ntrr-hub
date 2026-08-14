"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
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
  type TomorrowFocusItem,
} from "@/lib/dashboard/needs-attention";
import {
  formatClockCompactInZone,
  formatTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { updateTaskStatus } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

type NeedsAttentionPanelProps = {
  items: NeedsAttentionItem[];
  tomorrow?: TomorrowFocusItem[];
  tomorrowOverflow?: number;
  timeZone?: string;
  canCompleteTasks?: boolean;
};

/** Brief hold so the green Done state is visible before the row leaves the list. */
const DONE_FEEDBACK_MS = 900;

function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </h3>
  );
}

function tomorrowTimeLabel(item: TomorrowFocusItem, zone: string) {
  if (item.kind === "event" && item.allDay) {
    return "All day";
  }
  return formatClockCompactInZone(item.sortAt, zone);
}

export function NeedsAttentionPanel({
  items,
  tomorrow = [],
  tomorrowOverflow = 0,
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
        <CardTitle>Focus</CardTitle>
        <CardDescription className="line-clamp-2 sm:line-clamp-none">
          Today first — decisions, handoffs, and timing. Tomorrow is a light look ahead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section aria-labelledby="focus-today-heading" className="space-y-3">
          <SectionLabel id="focus-today-heading">Today</SectionLabel>
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
                      <div className="flex min-w-0 items-start gap-2">
                        {/* Assignee left of title — no source chip (Hub tasks are NTRR) */}
                        {isTask && !isDone ? (
                          <div className="flex h-6 w-[6.5rem] shrink-0 items-center overflow-hidden pt-0.5">
                            <AssigneeChip
                              label={item.assigneeLabel}
                              persona={item.assigneePersona}
                              unassigned={!item.assigneeLabel}
                              className="max-w-full"
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                      </div>
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
              All clear for now. When something needs a decision or a quick action, it&apos;ll show
              up here.
            </p>
          )}
        </section>

        <section
          aria-labelledby="focus-tomorrow-heading"
          className="border-border/70 space-y-2 border-t pt-4"
        >
          <SectionLabel id="focus-tomorrow-heading">Tomorrow</SectionLabel>
          {tomorrow.length ? (
            <ul className="space-y-1.5">
              {tomorrow.map((item) => (
                <li key={item.id} className="flex min-w-0 items-baseline gap-2.5 text-sm">
                  <span className="text-muted-foreground w-14 shrink-0 tabular-nums text-xs">
                    {tomorrowTimeLabel(item, zone)}
                  </span>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground min-w-0 truncate hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground min-w-0 truncate">{item.title}</span>
                  )}
                </li>
              ))}
              {tomorrowOverflow > 0 ? (
                <li className="text-muted-foreground pl-[4.25rem] text-xs">
                  +{tomorrowOverflow} more
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing timed for tomorrow yet.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
