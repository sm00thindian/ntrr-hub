"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { saveGoogleCalendarSettings } from "@/lib/integrations/actions";
import {
  CALENDAR_COLOR_PALETTE,
  type CalendarColorMember,
  type CalendarVisibility,
  type GoogleCalendarAssignment,
  memberCalendarCount,
  normalizeColor,
} from "@/lib/calendar/colors";
import type { GoogleCalendarInfo } from "@/lib/integrations/types";
import { cn } from "@/lib/utils";

type GoogleCalendarSettingsProps = {
  calendars: GoogleCalendarInfo[];
  selectedCalendarIds: string[];
  members: CalendarColorMember[];
  memberColors: Record<string, string>;
  calendarAssignments: Record<string, GoogleCalendarAssignment>;
  /** When false, hide household-wide member color editors (non-admin) */
  canEditMemberColors?: boolean;
  currentUserId: string;
};

export function GoogleCalendarSettings({
  calendars,
  selectedCalendarIds,
  members,
  memberColors: initialMemberColors,
  calendarAssignments: initialAssignments,
  canEditMemberColors = true,
  currentUserId,
}: GoogleCalendarSettingsProps) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(() => new Set(selectedCalendarIds));
  const [memberColors, setMemberColors] = useState(initialMemberColors);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [message, setMessage] = useState<string | null>(null);

  const selectedIds = useMemo(() => [...selected], [selected]);

  const hasChanges = useMemo(() => {
    if (
      selectedIds.length !== selectedCalendarIds.length ||
      selectedIds.some((id) => !selectedCalendarIds.includes(id))
    ) {
      return true;
    }

    if (JSON.stringify(memberColors) !== JSON.stringify(initialMemberColors)) {
      return true;
    }

    return JSON.stringify(assignments) !== JSON.stringify(initialAssignments);
  }, [
    assignments,
    initialAssignments,
    initialMemberColors,
    memberColors,
    selectedCalendarIds,
    selectedIds,
  ]);

  function toggleCalendar(calendarId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(calendarId);
      } else if (next.size > 1) {
        next.delete(calendarId);
      }
      return next;
    });
    setMessage(null);
  }

  function updateAssignment(
    calendarId: string,
    patch: Partial<GoogleCalendarAssignment>,
  ) {
    setAssignments((current) => {
      const existing = current[calendarId] ?? {
        memberUserId: members[0]?.userId ?? "",
        color: CALENDAR_COLOR_PALETTE[0]!,
      };

      return {
        ...current,
        [calendarId]: {
          ...existing,
          ...patch,
        },
      };
    });
    setMessage(null);
  }

  function handleSave() {
    startTransition(async () => {
      const payloadAssignments: Record<string, GoogleCalendarAssignment> = {};

      for (const calendarId of selectedIds) {
        const assignment = assignments[calendarId] ?? {
          memberUserId: currentUserId || members[0]?.userId || "",
          color: CALENDAR_COLOR_PALETTE[0]!,
          visibility: "household" as CalendarVisibility,
        };

        payloadAssignments[calendarId] = {
          memberUserId: assignment.memberUserId,
          color: normalizeColor(assignment.color, CALENDAR_COLOR_PALETTE[0]!),
          visibility: assignment.visibility === "personal" ? "personal" : "household",
        };
      }

      const result = await saveGoogleCalendarSettings({
        selectedCalendarIds: selectedIds,
        memberColors,
        calendarAssignments: payloadAssignments,
      });

      if ("error" in result && result.error) {
        setMessage(result.error);
        return;
      }

      setMessage("Calendar settings saved. Run sync to refresh events.");
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      {canEditMemberColors ? (
        <>
          <div>
            <p className="text-sm font-medium">Calendar colors</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Assign a family color to each member. When someone has more than one calendar, give
              each calendar its own accent color.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Family members
            </p>
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
                >
                  <span className="text-sm font-medium">{member.label}</span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Member color
                    <input
                      type="color"
                      value={memberColors[member.userId] ?? "#00C853"}
                      disabled={pending}
                      onChange={(event) =>
                        setMemberColors((current) => ({
                          ...current,
                          [member.userId]: event.target.value,
                        }))
                      }
                      className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Calendars to sync
        </p>
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground">Shared with household</span> is visible to
          everyone. <span className="font-medium text-foreground">Personal</span> is only visible to
          the selected family member (including you).
        </p>
        <ul className="space-y-2">
          {calendars.map((calendar) => {
            const checked = selected.has(calendar.id);
            const disableUncheck = checked && selected.size === 1;
            const assignment = assignments[calendar.id];
            const memberId = assignment?.memberUserId ?? members[0]?.userId ?? "";
            const showCalendarColor =
              checked &&
              memberId &&
              memberCalendarCount(memberId, selectedIds, assignments) > 1;

            return (
              <li
                key={calendar.id}
                className={cn(
                  "rounded-lg border px-3 py-3",
                  checked ? "border-brand/30 bg-brand/5" : "bg-card",
                )}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="border-input text-brand focus:ring-brand h-4 w-4 rounded"
                    checked={checked}
                    disabled={pending || disableUncheck}
                    onChange={(event) => toggleCalendar(calendar.id, event.target.checked)}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {calendar.summary}
                    {calendar.primary ? (
                      <span className="text-muted-foreground"> · Primary</span>
                    ) : null}
                  </span>
                </label>

                {checked ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">Visibility</span>
                      <select
                        className="border-input bg-background w-full rounded-md border px-2 py-2 text-sm"
                        value={assignment?.visibility === "personal" ? "personal" : "household"}
                        disabled={pending}
                        onChange={(event) =>
                          updateAssignment(calendar.id, {
                            visibility: event.target.value as CalendarVisibility,
                          })
                        }
                      >
                        <option value="household">Shared with household</option>
                        <option value="personal">Personal (only selected member)</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">Family member</span>
                      <select
                        className="border-input bg-background w-full rounded-md border px-2 py-2 text-sm"
                        value={memberId}
                        disabled={pending}
                        onChange={(event) =>
                          updateAssignment(calendar.id, { memberUserId: event.target.value })
                        }
                      >
                        {members.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {showCalendarColor ? (
                      <label className="space-y-1 text-xs sm:col-span-2">
                        <span className="text-muted-foreground">Calendar color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={assignment?.color ?? CALENDAR_COLOR_PALETTE[0]!}
                            disabled={pending}
                            onChange={(event) =>
                              updateAssignment(calendar.id, { color: event.target.value })
                            }
                            className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                          />
                          <CalendarPreview
                            memberColor={memberColors[memberId] ?? "#00C853"}
                            calendarColor={assignment?.color ?? CALENDAR_COLOR_PALETTE[0]!}
                          />
                        </div>
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={pending || !hasChanges} onClick={handleSave}>
          {pending ? "Saving…" : "Save calendar settings"}
        </Button>
        {message ? (
          <p className="text-muted-foreground text-xs" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CalendarPreview({
  memberColor,
  calendarColor,
}: {
  memberColor: string;
  calendarColor: string;
}) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: memberColor }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendarColor }} />
    </div>
  );
}