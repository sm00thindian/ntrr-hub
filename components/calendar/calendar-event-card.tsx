import { MapPin } from "lucide-react";

import { SourceChip } from "@/components/provenance/source-chip";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTimeInZone, resolveHouseholdTimeZone } from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";

function formatEventTime(event: CalendarEvent, timeZone: string) {
  if (event.allDay) {
    return "All day";
  }

  const start = formatTimeInZone(event.startsAt, timeZone);
  const end = formatTimeInZone(event.endsAt, timeZone);
  return `${start} – ${end}`;
}

export function CalendarEventCard({
  event,
  timeZone,
}: {
  event: CalendarEvent;
  timeZone?: string;
}) {
  const zone = resolveHouseholdTimeZone(timeZone);

  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-2.5",
        event.provenance.source === "ntrr" ? "border-brand/30 bg-brand/5" : "bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{event.title}</p>
        <SourceChip source={event.provenance.source} />
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {event.provenance.calendarName ? `${event.provenance.calendarName} · ` : ""}
        {formatEventTime(event, zone)}
      </p>
      {event.location ? (
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{event.location}</span>
        </p>
      ) : null}
    </article>
  );
}