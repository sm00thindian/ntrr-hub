import Link from "next/link";

import { AgendaItemRow } from "@/components/dashboard/agenda-item-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgendaItem } from "@/lib/dashboard/types";
import { agendaSortTimeMs } from "@/lib/datetime/timezone";

function sortAgendaItems(items: AgendaItem[]) {
  return [...items].sort((a, b) => {
    const aAllDay = a.kind === "event" && a.allDay ? 0 : 1;
    const bAllDay = b.kind === "event" && b.allDay ? 0 : 1;
    if (aAllDay !== bAllDay) {
      return aAllDay - bAllDay;
    }

    const startDiff = agendaSortTimeMs(a.sortAt) - agendaSortTimeMs(b.sortAt);
    if (startDiff !== 0) {
      return startDiff;
    }

    const endDiff = agendaSortTimeMs(a.endsAt) - agendaSortTimeMs(b.endsAt);
    if (endDiff !== 0) {
      return endDiff;
    }

    return a.title.localeCompare(b.title);
  });
}

export function DayAgenda({
  items,
  timeZone,
  memberColors = {},
}: {
  items: AgendaItem[];
  timeZone?: string;
  memberColors?: Record<string, string>;
}) {
  const sorted = sortAgendaItems(items);
  const eventCount = sorted.filter((item) => item.kind === "event").length;
  const taskCount = sorted.filter((item) => item.kind === "task").length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Today&apos;s agenda</CardTitle>
          <CardDescription>
            {taskCount} Hub task{taskCount === 1 ? "" : "s"} · {eventCount} calendar item
            {eventCount === 1 ? "" : "s"}
            <span className="hidden sm:inline">
              {" "}
              (synced for context — manage them in Google or Apple)
            </span>
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-10 flex-1 sm:flex-none">
            <Link href="/calendar">Open calendar</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="min-h-10 flex-1 sm:flex-none">
            <Link href="/settings">Integrations</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length ? (
          <ul className="space-y-2">
            {sorted.map((item) => (
              <AgendaItemRow
                key={item.id}
                item={item}
                timeZone={timeZone}
                memberColors={memberColors}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quiet day. Add tasks on the Tasks board, or connect a calendar in Settings to pull
            today&apos;s events for family context — Hub doesn&apos;t replace your calendar apps.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
