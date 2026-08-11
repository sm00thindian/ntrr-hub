"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { ReliantConfirmChip } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgendaItem } from "@/lib/dashboard/types";
import {
  agendaSortTimeMs,
  formatTimeInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { updateTaskStatus } from "@/lib/tasks/actions";

type MyDayPanelProps = {
  items: AgendaItem[];
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
 */
export function MyDayPanel({
  items,
  timeZone,
  canCompleteTasks = true,
  householdName,
}: MyDayPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nowMs = Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My day</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {householdName} · your tasks and appointments
        </p>
      </div>

      <Card className="border-brand/20">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            What you need to do. Items marked{" "}
            <span className="text-foreground font-medium">Reliant</span> may get a phone
            confirmation call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <ul className="space-y-1">
              {items.map((item) => {
                const isTask = item.kind === "task";
                const overdue =
                  isTask &&
                  item.sortAt &&
                  agendaSortTimeMs(item.sortAt) < nowMs &&
                  item.status !== "done";

                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-3 hover:border-border hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-base font-medium leading-snug">{item.title}</p>
                        {item.reliantConfirmRequested ? <ReliantConfirmChip /> : null}
                      </div>
                      <p
                        className={
                          overdue
                            ? "text-destructive mt-0.5 text-sm"
                            : "text-muted-foreground mt-0.5 text-sm"
                        }
                      >
                        {isTask ? "Task" : "Calendar"} · {timeLabel(item, zone, nowMs)}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                    {isTask &&
                    canCompleteTasks &&
                    item.entityId &&
                    item.status !== "done" ? (
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
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nothing on your day yet. When someone assigns you a task or links your calendar,
              it will show up here.
            </p>
          )}
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
