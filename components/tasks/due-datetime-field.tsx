"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDaysToWallDate,
  combineWallDateTime,
  formatWallDate,
  formatWallTime,
  zonedNowParts,
} from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";

type DueDateTimeFieldProps = {
  timeZone: string;
  timeZoneLabel: string;
  idPrefix?: string;
  className?: string;
};

const TIME_PRESETS = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
  { label: "8:00 PM", hour: 20, minute: 0 },
] as const;

/**
 * Friendlier due control: separate date + time, quick chips, hidden dueAt for forms.
 * Values are wall clock in household timezone (same contract as datetime-local).
 */
export function DueDateTimeField({
  timeZone,
  timeZoneLabel,
  idPrefix = "due",
  className,
}: DueDateTimeFieldProps) {
  const now = useMemo(() => zonedNowParts(timeZone), [timeZone]);
  const today = formatWallDate(now.year, now.month, now.day);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const combined = combineWallDateTime(date, time);
  const hasDue = Boolean(date);

  function setToday() {
    setDate(today);
    if (!time) {
      setTime(formatWallTime(9, 0));
    }
  }

  function setTomorrow() {
    setDate(addDaysToWallDate(today, 1));
    if (!time) {
      setTime(formatWallTime(9, 0));
    }
  }

  function setTonight() {
    setDate(today);
    setTime(formatWallTime(20, 0));
  }

  function clearDue() {
    setDate("");
    setTime("");
  }

  function applyTimePreset(hour: number, minute: number) {
    if (!date) {
      setDate(today);
    }
    setTime(formatWallTime(hour, minute));
  }

  return (
    <div className={cn("space-y-3 sm:col-span-2", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label className="text-sm font-medium">Due (optional)</Label>
        <p className="text-muted-foreground text-xs">{timeZoneLabel}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ChipButton type="button" onClick={setToday} active={date === today && hasDue}>
          Today
        </ChipButton>
        <ChipButton
          type="button"
          onClick={setTomorrow}
          active={date === addDaysToWallDate(today, 1)}
        >
          Tomorrow
        </ChipButton>
        <ChipButton type="button" onClick={setTonight}>
          Tonight 8pm
        </ChipButton>
        {hasDue ? (
          <ChipButton type="button" onClick={clearDue} muted>
            Clear
          </ChipButton>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-date`} className="text-muted-foreground text-xs font-normal">
            Date
          </Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value && !time) {
                setTime(formatWallTime(9, 0));
              }
            }}
            className="[color-scheme:light]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-time`} className="text-muted-foreground text-xs font-normal">
            Time
          </Label>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={time}
            disabled={!date}
            onChange={(e) => setTime(e.target.value)}
            className="[color-scheme:light]"
          />
        </div>
      </div>

      {date ? (
        <div className="flex flex-wrap gap-2">
          {TIME_PRESETS.map((preset) => {
            const value = formatWallTime(preset.hour, preset.minute);
            return (
              <ChipButton
                key={preset.label}
                type="button"
                onClick={() => applyTimePreset(preset.hour, preset.minute)}
                active={time === value}
              >
                {preset.label}
              </ChipButton>
            );
          })}
        </div>
      ) : null}

      {/* Submitted to createTask as dueAt (wall time in household TZ) */}
      <input type="hidden" name="dueAt" value={combined} />

      <p className="text-muted-foreground text-xs leading-relaxed">
        {hasDue
          ? `Due ${date}${time ? ` at ${formatTimeLabel(time)}` : " (set a time or leave morning default)"}.`
          : "Tap Today / Tomorrow, or pick a date — times are household timezone."}
      </p>
    </div>
  );
}

function formatTimeLabel(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return hhmm;
  }
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function ChipButton({
  children,
  active,
  muted,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : muted
            ? "border-border text-muted-foreground hover:bg-muted"
            : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
