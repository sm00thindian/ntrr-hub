"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, Check, ListTodo, MapPin } from "lucide-react";

import { useOptimisticTaskDone } from "@/components/dashboard/use-optimistic-task-done";
import { TomorrowPreview } from "@/components/dashboard/tomorrow-preview";
import {
  AssigneeChip,
  ReliantConfirmChip,
  ReliantSmsReminderChip,
} from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveMemberChipColor } from "@/lib/calendar/colors";
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
import { cn } from "@/lib/utils";

type NeedsAttentionPanelProps = {
  items: NeedsAttentionItem[];
  tomorrow?: TomorrowFocusItem[];
  tomorrowOverflow?: number;
  timeZone?: string;
  canCompleteTasks?: boolean;
  /** Household member colors for assignee chip accents */
  memberColors?: Record<string, string>;
};

function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </h3>
  );
}

function taskTimeLabel(item: NeedsAttentionItem, zone: string, nowMs: number, isDone: boolean) {
  if (item.reason === "conflict") {
    return "Review";
  }
  if (isDone) {
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
 * Mark Done paints green and sinks the row immediately (server confirms in background).
 */
export function NeedsAttentionPanel({
  items,
  tomorrow = [],
  tomorrowOverflow = 0,
  timeZone,
  canCompleteTasks = true,
  memberColors = {},
}: NeedsAttentionPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const { isTaskDone, isPending, markDone, reopen, actionError } = useOptimisticTaskDone(items);
  const nowMs = Date.now();

  // Client sort mirrors server: done rows sink so progress is visible without waiting on refresh.
  const displayItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.reason === "conflict" && b.reason !== "conflict") return -1;
      if (b.reason === "conflict" && a.reason !== "conflict") return 1;

      const aDone =
        a.reason === "done" || isTaskDone(a.entityId, a.status) ? 1 : 0;
      const bDone =
        b.reason === "done" || isTaskDone(b.entityId, b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const aOverdue = !aDone && a.reason === "overdue" ? 0 : 1;
      const bOverdue = !bDone && b.reason === "overdue" ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      if (!aDone && !bDone && a.reason !== "overdue" && b.reason !== "overdue") {
        const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
        const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
        if (aAllDay !== bAllDay) return aAllDay - bAllDay;
      }

      const startDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
      if (startDiff !== 0) return startDiff;
      return a.title.localeCompare(b.title);
    });
  }, [items, isTaskDone]);

  return (
    <Card className="border-brand/20">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Focus</CardTitle>
          <CardDescription>Tap Done when finished — stays green for the day.</CardDescription>
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
          {displayItems.length ? (
            <ul className="space-y-1.5">
              {displayItems.map((item) => {
                const isConflict = item.reason === "conflict";
                const isEvent = item.kind === "event" && item.reason === "calendar";
                const isTask = item.kind === "task" && !isConflict;
                const isDone =
                  item.reason === "done" || isTaskDone(item.entityId, item.status);
                const isException =
                  !isDone && (item.reason === "overdue" || item.reason === "conflict");
                const isPastEvent =
                  isEvent &&
                  !item.allDay &&
                  agendaSortTimeMs(item.endsAt ?? item.sortAt) < nowMs;
                const rowPending = isPending(item.entityId);

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-2.5 py-2.5 transition-[background-color,border-color,opacity] duration-150 sm:gap-3",
                      isDone && "border-brand/25 bg-brand/5",
                      isException && !isDone && "border-destructive/25 bg-destructive/5",
                      !isDone && !isException && "border-border/60 bg-card",
                      isPastEvent && "opacity-70",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
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
                              memberColor={resolveMemberChipColor(
                                item.assigneeId,
                                memberColors,
                              )}
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
                            {item.reliantSmsReminderRequested && !isDone ? (
                              <ReliantSmsReminderChip />
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
                                {taskTimeLabel(item, zone, nowMs, isDone)}
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
                        onMarkDone={() => markDone(item.entityId!)}
                        onReopen={isDone ? () => reopen(item.entityId!) : undefined}
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
