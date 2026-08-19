"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { ReliantConfirmChip, ReliantSmsReminderChip } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgendaItem } from "@/lib/dashboard/types";
import { formatTimeInZone, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { updateTaskStatus } from "@/lib/tasks/actions";

type PrioritiesPanelProps = {
  items: AgendaItem[];
  timeZone?: string;
  canCompleteTasks?: boolean;
};

/**
 * Compact "what's next" list. Done is only for tasks — calendar events aren't
 * completable here (they're external schedule, not board work).
 */
export function PrioritiesPanel({
  items,
  timeZone,
  canCompleteTasks = true,
}: PrioritiesPanelProps) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s priorities</CardTitle>
        <CardDescription>
          Tasks you can complete here. Calendar items are from your connected calendars — Hub is not
          a calendar app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="relative space-y-0">
            {items.map((item, index) => {
              const isTask = item.kind === "task";
              const timeLabel =
                item.kind === "event"
                  ? item.allDay
                    ? "All day"
                    : formatTimeInZone(item.sortAt, zone)
                  : item.sortAt
                    ? `Due ${formatTimeInZone(item.sortAt, zone)}`
                    : "No due time";

              return (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < items.length - 1 ? (
                    <span
                      className="bg-brand absolute top-3 left-[5px] h-[calc(100%-4px)] w-0.5"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className="bg-brand relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      {item.reliantConfirmRequested ? <ReliantConfirmChip /> : null}
                      {item.reliantSmsReminderRequested ? <ReliantSmsReminderChip /> : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {isTask ? "Hub task" : "From calendar"} · {timeLabel}
                    </p>
                  </div>
                  {isTask && canCompleteTasks && item.entityId && item.status !== "done" ? (
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
            Nothing due yet. Add Hub tasks or connect calendars in Settings for today&apos;s context.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
