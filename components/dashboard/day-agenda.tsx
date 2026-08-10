import Link from "next/link";

import { AgendaItemRow } from "@/components/dashboard/agenda-item-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgendaItem } from "@/lib/dashboard/types";

export function DayAgenda({ items, timeZone }: { items: AgendaItem[]; timeZone?: string }) {
  const eventCount = items.filter((item) => item.kind === "event").length;
  const taskCount = items.filter((item) => item.kind === "task").length;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Today&apos;s agenda</CardTitle>
          <CardDescription>
            {taskCount} task{taskCount === 1 ? "" : "s"} · {eventCount} event
            {eventCount === 1 ? "" : "s"} from your connected calendars
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/settings">Integrations</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-2">
            {items.map((item) => (
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