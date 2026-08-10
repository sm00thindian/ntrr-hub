import { Calendar, ListTodo, MapPin } from "lucide-react";

import { ReliantConfirmChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import type { AgendaItem } from "@/lib/dashboard/types";
import { formatTimeInZone, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

function formatTime(iso: string, timeZone: string, allDay?: boolean) {
  if (allDay) {
    return "All day";
  }
  return formatTimeInZone(iso, timeZone);
}

function formatRange(start: string, end: string | undefined, timeZone: string, allDay?: boolean) {
  if (allDay) {
    return "All day";
  }
  const startLabel = formatTime(start, timeZone);
  if (!end) {
    return startLabel;
  }
  const endLabel = formatTime(end, timeZone);
  return `${startLabel} – ${endLabel}`;
}

export function AgendaItemRow({ item, timeZone }: { item: AgendaItem; timeZone?: string }) {
  const zone = resolveHouseholdTimeZone(timeZone);
  const Icon = item.kind === "event" ? Calendar : ListTodo;

  return (
    <li className="flex gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          item.kind === "event" ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <SourceChip source={item.source} />
          {item.reliantConfirmRequested ? <ReliantConfirmChip /> : null}
          {item.status ? (
            <span className="text-muted-foreground text-xs">{TASK_STATUS_LABELS[item.status]}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {item.kind === "event"
            ? formatRange(item.sortAt, item.endsAt, zone, item.allDay)
            : item.sortAt
              ? `Due ${formatTime(item.sortAt, zone)}`
              : "No due time"}
        </p>
        {item.location ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.location}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}