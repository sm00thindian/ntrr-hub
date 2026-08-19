import Link from "next/link";

import type { CalendarColorContext } from "@/lib/calendar/colors";
import { buildLegendEntries } from "@/lib/calendar/colors";

export function CalendarColorLegend({ context }: { context: CalendarColorContext }) {
  const entries = buildLegendEntries(context);
  const hasNestedCalendars = entries.some((entry) => entry.calendars.length > 0);
  const hasMultipleCalendars = entries.some((entry) => entry.calendars.length > 1);

  if (!entries.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Family colors
        </p>
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
        >
          Edit in Settings
        </Link>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {entries.map((entry) => (
          <div key={entry.member.userId} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="font-medium">{entry.member.label}</span>
            </div>

            {entry.calendars.length > 0 ? (
              <ul className="text-muted-foreground space-y-1 pl-5 text-xs">
                {entry.calendars.map((calendar) => (
                  <li key={calendar.calendarId} className="flex items-center gap-2">
                    <span className="flex h-3 w-2 shrink-0 items-stretch gap-0.5" aria-hidden="true">
                      <span
                        className="w-1.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span
                        className="w-1 rounded-full"
                        style={{ backgroundColor: calendar.color }}
                      />
                    </span>
                    <span className="truncate">
                      {calendar.name}
                      {calendar.visibility === "personal" ? " (personal)" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {hasMultipleCalendars ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Each person has a primary color for tasks and events. Shared calendars and your personal
          calendars nest underneath; a second accent bar distinguishes which calendar an event came
          from when someone has more than one.
        </p>
      ) : hasNestedCalendars ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Each person has a primary color for tasks and events. Shared family calendars and your
          personal calendars are listed under the person they belong to.
        </p>
      ) : (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Each person has a primary color for assigned tasks. Connect calendars in Settings to see
          shared and personal calendars here too.
        </p>
      )}
    </div>
  );
}
