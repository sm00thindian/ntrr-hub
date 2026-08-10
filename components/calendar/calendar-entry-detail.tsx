"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Calendar, ListTodo, MapPin, X } from "lucide-react";

import { CalendarEntryColors } from "@/components/calendar/calendar-entry-colors";
import { ReliantConfirmChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import { Button } from "@/components/ui/button";
import type { CalendarColorContext } from "@/lib/calendar/colors";
import { resolveEntryColors } from "@/lib/calendar/resolve-entry-colors";
import type { CalendarEntry } from "@/lib/calendar/entries";
import { formatEntryDate, formatEntryTime } from "@/lib/calendar/entries";
import { TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type CalendarEntryDetailProps = {
  entry: CalendarEntry | null;
  colorContext: CalendarColorContext;
  timeZone: string;
  onClose: () => void;
};

export function CalendarEntryDetail({
  entry,
  colorContext,
  timeZone,
  onClose,
}: CalendarEntryDetailProps) {
  useEffect(() => {
    if (!entry) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entry, onClose]);

  if (!entry) {
    return null;
  }

  const isTask = entry.kind === "task";
  const title = isTask ? entry.task.title : entry.event.title;
  const description = isTask ? entry.task.description : entry.event.description;
  const location = isTask ? null : entry.event.location;
  const source = isTask ? entry.task.provenance.source : entry.event.provenance.source;
  const reliantConfirm = isTask
    ? Boolean(entry.task.reliantConfirmRequested)
    : Boolean(entry.event.reliantConfirmRequested);
  const colors = resolveEntryColors(entry, colorContext);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-entry-title"
        className={cn(
          "bg-card w-full max-w-lg rounded-2xl border shadow-xl",
          "max-h-[85vh] overflow-y-auto",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                isTask ? "bg-brand/10 text-brand" : "bg-muted text-foreground",
              )}
            >
              {isTask ? (
                <ListTodo className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Calendar className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide">
                <span>{isTask ? "Task" : "Calendar event"}</span>
                {reliantConfirm ? <ReliantConfirmChip /> : null}
              </p>
              <h2 id="calendar-entry-title" className="mt-1 text-lg font-semibold leading-tight">
                {title}
              </h2>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                When
              </dt>
              <dd className="mt-1 font-medium">{formatEntryDate(entry, timeZone)}</dd>
              <dd className="text-muted-foreground">{formatEntryTime(entry, timeZone)}</dd>
            </div>

            {colors.memberLabel ? (
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Family member
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  <CalendarEntryColors colors={colors} className="h-4" />
                  <span>{colors.memberLabel}</span>
                </dd>
              </div>
            ) : null}

            {isTask ? (
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Status
                </dt>
                <dd className="mt-1">{TASK_STATUS_LABELS[entry.task.status]}</dd>
              </div>
            ) : null}

            {location ? (
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Location
                </dt>
                <dd className="mt-1 flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{location}</span>
                </dd>
              </div>
            ) : null}

            {description ? (
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed">{description}</dd>
              </div>
            ) : null}

            <div>
              <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Source
              </dt>
              <dd className="mt-2">
                <SourceChip source={source} />
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {isTask ? (
              <Button asChild>
                <Link href="/tasks">Open task board</Link>
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}