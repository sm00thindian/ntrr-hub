"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Check, ListTodo, MapPin } from "lucide-react";

import { TomorrowPreview } from "@/components/dashboard/tomorrow-preview";
import { AssigneeChip, ReliantConfirmChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  attentionReasonLabel,
  type NeedsAttentionItem,
  type TomorrowFocusItem,
} from "@/lib/dashboard/needs-attention";
import {
  agendaSortTimeMs,
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

const DONE_FEEDBACK_MS = 900;

function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </h3>
  );
}

function taskTimeLabel(item: NeedsAttentionItem, zone: string, nowMs: number) {
  if (item.reason === "conflict") {
    return "Review";
  }
  if (item.status === "done") {
    return "Completed";
  }
  if (!item.sortAt || agendaSortTimeMs(item.sortAt) === Number.POSITIVE_INFINITY) {
    return item.reason === "unassigned" ? "No owner" : "No due time";
  }
  const dueMs = agendaSortTimeMs(item.sortAt);
  if (dueMs < nowMs) {
    return `Was ${formatTimeInZone(item.sortAt, zone)}`;
  }
  return formatTimeInZone(item.sortAt, zone);
}

function eventTimeLabel(item: NeedsAttentionItem, zone: string) {
  if (item.allDay) {
    return "All day";
  }
  const start = formatTimeInZone(item.sortAt, zone);
  if (!item.endsAt) {
    return start;
  }
  return `${start} – ${formatTimeInZone(item.endsAt, zone)}`;
}

/**
 * Caregiver Focus: single household day board.
 * Today = Hub tasks + shared calendars; Tomorrow = one-off changes only.
 */
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
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  /** Optimistic Done so the row turns green immediately (server keeps done-today after refresh). */
  const [justDoneIds, setJustDoneIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const nowMs = Date.now();

  return (
    <Card className="border-brand/20">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Focus</CardTitle>
          <CardDescription className="line-clamp-3 sm:line-clamp-none">
            Household day — Hub tasks and shared calendars. Mark Done and it stays green for the
            day. Tomorrow: outside the usual only.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-10 flex-1 sm:flex-none">
            <Link href="/calendar">Open calendar</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="min-h-10 flex-1 sm:flex-none">
            <Link href="/tasks">Tasks</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {actionError ? (
          <p className="text-destructive text-sm" role="alert">
            {actionError}
          </p>
        ) : null}
        <section aria-labelledby="focus-today-heading" className="space-y-3">
          <SectionLabel id="focus-today-heading">Today</SectionLabel>
          {items.length ? (
            <ul className="space-y-1.5">
              {items.map((item) => {
                const isConflict = item.reason === "conflict";
                const isEvent = item.kind === "event" && item.reason === "calendar";
                const isTask = item.kind === "task" && !isConflict;
                const isDone =
                  item.status === "done" ||
                  item.reason === "done" ||
                  Boolean(item.entityId && justDoneIds.has(item.entityId));
                const isException =
                  !isDone && (item.reason === "overdue" || item.reason === "conflict");
                const isPastEvent =
                  isEvent &&
                  !item.allDay &&
                  agendaSortTimeMs(item.endsAt ?? item.sortAt) < nowMs;
                const rowPending = Boolean(
                  item.entityId && pending && pendingIds.has(item.entityId),
                );

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors sm:gap-3",
                      isDone && "border-brand/25 bg-brand/5",
                      isException && !isDone && "border-destructive/25 bg-destructive/5",
                      !isDone && !isException && "border-border/60 bg-card",
                      isPastEvent && "opacity-70",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        isDone && "bg-brand text-brand-foreground",
                        isException && !isDone && "bg-destructive/15 text-destructive",
                        isEvent && !isDone && !isException && "bg-brand/10 text-brand",
                        isTask && !isDone && !isException && "bg-muted text-muted-foreground",
                        isConflict && !isDone && "bg-destructive/15 text-destructive",
                      )}
                      aria-hidden
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      ) : isEvent ? (
                        <Calendar className="h-4 w-4" />
                      ) : (
                        <ListTodo className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                        {isTask && !isDone ? (
                          <div className="flex h-6 w-full max-w-[7rem] shrink-0 items-center overflow-hidden sm:w-[6.5rem]">
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
                              isDone && "text-brand/80",
                              isException && !isDone && "text-destructive/90",
                              !isDone && !isException && "text-muted-foreground",
                            )}
                          >
                            {isEvent ? (
                              <>
                                <span className="font-medium text-foreground/75">Calendar</span>
                                {" · "}
                                {eventTimeLabel(item, zone)}
                              </>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    "font-medium",
                                    isDone ? "text-brand" : "text-foreground/80",
                                  )}
                                >
                                  {isDone ? "Done" : attentionReasonLabel(item.reason)}
                                </span>
                                {" · "}
                                {taskTimeLabel(item, zone, nowMs)}
                              </>
                            )}
                          </p>
                          {isEvent && item.location ? (
                            <p className="text-muted-foreground flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="truncate">{item.location}</span>
                            </p>
                          ) : null}
                        </div>

                        {isEvent && !isDone ? (
                          <div className="flex shrink-0 items-center sm:pt-0.5">
                            <SourceChip source={item.source} />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isConflict && item.href && !isDone ? (
                      <Button asChild size="sm" variant="outline" className="mt-0.5 shrink-0">
                        <Link href={item.href}>Resolve</Link>
                      </Button>
                    ) : null}
                    {isTask && canCompleteTasks && item.entityId ? (
                      <TaskDoneControl
                        title={item.title}
                        done={isDone}
                        pending={rowPending}
                        className="mt-0.5"
                        onMarkDone={() => {
                          const taskId = item.entityId!;
                          setActionError(null);
                          setJustDoneIds((prev) => new Set(prev).add(taskId));
                          setPendingIds((prev) => new Set(prev).add(taskId));
                          startTransition(async () => {
                            const result = await updateTaskStatus(taskId, "done");
                            setPendingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(taskId);
                              return next;
                            });
                            if (result?.error) {
                              setJustDoneIds((prev) => {
                                const next = new Set(prev);
                                next.delete(taskId);
                                return next;
                              });
                              setActionError(result.error);
                              return;
                            }
                            window.setTimeout(() => {
                              router.refresh();
                            }, DONE_FEEDBACK_MS);
                          });
                        }}
                        onReopen={
                          isDone
                            ? () => {
                                const taskId = item.entityId!;
                                setActionError(null);
                                setJustDoneIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(taskId);
                                  return next;
                                });
                                setPendingIds((prev) => new Set(prev).add(taskId));
                                startTransition(async () => {
                                  const result = await updateTaskStatus(taskId, "todo");
                                  setPendingIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(taskId);
                                    return next;
                                  });
                                  if (result?.error) {
                                    setActionError(result.error);
                                    return;
                                  }
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
            <p className="text-muted-foreground text-sm leading-relaxed">
              Quiet day for shared calendars and Hub tasks. When something is due or on the family
              calendar, it shows up here.
            </p>
          )}
        </section>

        <TomorrowPreview
          items={tomorrow}
          overflow={tomorrowOverflow}
          timeZone={zone}
          headingId="focus-tomorrow-heading"
          showAssignee
        />
      </CardContent>
    </Card>
  );
}
