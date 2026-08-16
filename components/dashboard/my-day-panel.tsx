"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";

import { useOptimisticTaskDone } from "@/components/dashboard/use-optimistic-task-done";
import { TomorrowPreview } from "@/components/dashboard/tomorrow-preview";
import { ReliantConfirmChip } from "@/components/family/role-badge";
import { TaskDoneControl } from "@/components/tasks/task-done-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TomorrowFocusItem } from "@/lib/dashboard/needs-attention";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  agendaSortTimeMs,
  formatTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";

type MyDayPanelProps = {
  items: AgendaItem[];
  tomorrow?: TomorrowFocusItem[];
  tomorrowOverflow?: number;
  timeZone?: string;
  canCompleteTasks?: boolean;
  householdName: string;
};

function timeLabel(item: AgendaItem, zone: string, nowMs: number, isDone: boolean) {
  if (item.kind === "event") {
    if (item.allDay) {
      return "All day";
    }
    return formatTimeInZone(item.sortAt, zone);
  }

  if (isDone) {
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
 * Mark Done is optimistic: green + sink to bottom immediately.
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
  const { isTaskDone, isPending, markDone, reopen, actionError } = useOptimisticTaskDone(items);
  const nowMs = Date.now();

  const displayItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aDone = a.kind === "task" && isTaskDone(a.entityId, a.status) ? 1 : 0;
      const bDone = b.kind === "task" && isTaskDone(b.entityId, b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
      const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
      if (aAllDay !== bAllDay) return aAllDay - bAllDay;

      const startDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
      if (startDiff !== 0) return startDiff;
      return a.title.localeCompare(b.title);
    });
  }, [items, isTaskDone]);

  const openCount = displayItems.filter(
    (i) => i.kind === "task" && !isTaskDone(i.entityId, i.status),
  ).length;
  const doneCount = displayItems.filter(
    (i) => i.kind === "task" && isTaskDone(i.entityId, i.status),
  ).length;

  const progressParts: string[] = [];
  if (doneCount > 0) {
    progressParts.push(`${doneCount} done`);
  }
  if (openCount > 0) {
    progressParts.push(`${openCount} left`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My day</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {progressParts.length > 0 ? (
            <>
              {householdName}
              <span className="text-brand"> · {progressParts.join(" · ")}</span>
            </>
          ) : (
            householdName
          )}
        </p>
      </div>

      <Card className="border-brand/20">
        <CardHeader className="pb-3">
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {displayItems.length ? (
            <ul className="space-y-1">
              {displayItems.map((item) => {
                const isTask = item.kind === "task";
                const isDone = isTask && isTaskDone(item.entityId, item.status);
                const overdue =
                  isTask &&
                  !isDone &&
                  item.sortAt &&
                  agendaSortTimeMs(item.sortAt) < nowMs;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-2 py-3 transition-[background-color,border-color] duration-150",
                      isDone
                        ? "border-brand/25 bg-brand/5"
                        : "border-transparent hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
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
                        {isTask ? "Task" : "Calendar"} · {timeLabel(item, zone, nowMs, isDone)}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                    {isTask && canCompleteTasks && item.entityId ? (
                      <TaskDoneControl
                        title={item.title}
                        done={isDone}
                        pending={isPending(item.entityId)}
                        className="mt-0.5"
                        onMarkDone={() => markDone(item.entityId!)}
                        onReopen={() => reopen(item.entityId!)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nothing on your day yet. When someone assigns you a task or links your calendar, it
              will show up here. Tap Done when a task is finished.
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
