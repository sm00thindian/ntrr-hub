import Link from "next/link";

import type { TomorrowFocusItem } from "@/lib/dashboard/needs-attention";
import {
  formatClockCompactInZone,
  resolveHouseholdTimeZone,
} from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";

function tomorrowTimeLabel(item: TomorrowFocusItem, zone: string) {
  if (item.kind === "event" && item.allDay) {
    return "All day";
  }
  return formatClockCompactInZone(item.sortAt, zone);
}

type TomorrowPreviewProps = {
  items: TomorrowFocusItem[];
  overflow?: number;
  timeZone?: string;
  /** Heading id for aria-labelledby */
  headingId?: string;
  /**
   * Caregiver Focus: show "Assignee - task title" as plain text (no chip).
   * My day hides this — the list is already only their tasks.
   */
  showAssignee?: boolean;
  className?: string;
};

function tomorrowTitleLabel(item: TomorrowFocusItem, showAssignee: boolean) {
  if (!showAssignee) {
    return item.title;
  }
  const who = item.assigneeLabel?.trim() || "Unassigned";
  return `${who} - ${item.title}`;
}

/**
 * Calm look-ahead: one-off (non-recurring) tasks only — for Focus and My day.
 * Daily routines stay off this list so schedule changes are easier to spot.
 */
export function TomorrowPreview({
  items,
  overflow = 0,
  timeZone,
  headingId = "tomorrow-preview-heading",
  showAssignee = false,
  className,
}: TomorrowPreviewProps) {
  const zone = resolveHouseholdTimeZone(timeZone);

  return (
    <section
      aria-labelledby={headingId}
      className={cn("border-border/70 space-y-2 border-t pt-4", className)}
    >
      <h3
        id={headingId}
        className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
      >
        Tomorrow
      </h3>
      <p className="text-muted-foreground text-[11px] leading-snug">
        Outside the usual only — not daily routines.
      </p>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const label = tomorrowTitleLabel(item, showAssignee);
            return (
              <li key={item.id} className="flex min-w-0 items-baseline gap-2.5 text-sm">
                <span className="text-muted-foreground w-14 shrink-0 tabular-nums text-xs">
                  {tomorrowTimeLabel(item, zone)}
                </span>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground min-w-0 truncate hover:underline"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground min-w-0 truncate">{label}</span>
                )}
              </li>
            );
          })}
          {overflow > 0 ? (
            <li className="text-muted-foreground pl-[4.25rem] text-xs">+{overflow} more</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nothing outside the usual tomorrow — a quieter day for the usual routine.
        </p>
      )}
    </section>
  );
}
