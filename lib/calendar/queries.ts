import type { Provenance } from "@/lib/provenance/types";
import { createClient } from "@/lib/supabase/server";

import type { TaskStatus } from "@/lib/tasks/types";

import type { CalendarEvent, CalendarTask } from "./types";

function mapEvent(row: {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  reliant_confirm_requested?: boolean | null;
  provenance: Provenance;
  created_at: string;
  updated_at: string;
}): CalendarEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    location: row.location,
    reliantConfirmRequested: Boolean(row.reliant_confirm_requested),
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getCalendarEventsForRange(
  householdId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      "id, household_id, title, description, starts_at, ends_at, all_day, location, reliant_confirm_requested, provenance, created_at, updated_at",
    )
    .eq("household_id", householdId)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapEvent(row as Parameters<typeof mapEvent>[0]));
}

export async function getTodayCalendarEvents(householdId: string): Promise<CalendarEvent[]> {
  const { start, end } = getDayBounds();
  return getCalendarEventsForRange(householdId, start, end);
}

export async function getTasksDueInRange(
  householdId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarTask[]> {
  const supabase = await createClient();
  const { getHouseholdMembers } = await import("@/lib/households/queries");
  const { resolveAssigneeDisplay } = await import("@/lib/households/member-label");

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, assignee_id, due_at, status, reliant_confirm_requested, provenance")
    .eq("household_id", householdId)
    .not("due_at", "is", null)
    .in("status", ["todo", "in_progress"])
    .gte("due_at", rangeStart)
    .lt("due_at", rangeEnd)
    .order("due_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const members = await getHouseholdMembers(householdId);

  return data.map((row) => {
    const assigneeId = (row.assignee_id as string | null) ?? null;
    const assignee = resolveAssigneeDisplay(assigneeId, members);
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      assigneeId,
      assigneeLabel: assignee.label,
      assigneePersona: assignee.persona,
      dueAt: row.due_at as string,
      status: row.status as TaskStatus,
      reliantConfirmRequested: Boolean(
        (row as { reliant_confirm_requested?: boolean }).reliant_confirm_requested,
      ),
      reliantSmsReminderRequested: Boolean(
        (row as { reliant_sms_reminder_requested?: boolean }).reliant_sms_reminder_requested,
      ),
      provenance: row.provenance as CalendarTask["provenance"],
    };
  });
}