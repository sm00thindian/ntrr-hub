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

export function DayAgenda({ items, timeZone }: { items: AgendaItem[]; timeZone?: string }) {
  const sorted = sortAgendaItems(items);
  const eventCount = sorted.filter((item) => item.kind === "event").length;
  const taskCount = sorted.filter((item) => item.kind === "task").length;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Today&apos;s agenda</CardTitle>
          <CardDescription>
            {taskCount} task{taskCount === 1 ? "" : "s"} · {eventCount} event
            {eventCount === 1 ? "" : "s"} from your connected calendars
            {timeZone ? ` · times in household timezone` : ""}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/settings">Integrations</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sorted.length ? (
          <ul className="space-y-2">
            {sorted.map((item) => (
              <AgendaItemRow key={item.id} item={item} timeZone={timeZone} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled for today. Connect Google or Apple in Settings, run sync, and your
            family calendar will show up here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
