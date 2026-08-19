import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextRecurringDueAt, parseDueTime } from "./recurrence";
import {
  afterInstantForNextSpawn,
  isRecurringDueBeforeWallDay,
  isRecurringDueMissed,
  pickOpenRecurringKeeper,
} from "./spawn-recurring";
import {
  buildTaskBoardSections,
  selectBoardTasks,
} from "./queries";
import type { Task } from "./types";

describe("parseDueTime", () => {
  it("normalizes HH:mm", () => {
    assert.equal(parseDueTime("9:00"), "09:00");
    assert.equal(parseDueTime("17:30"), "17:30");
    assert.equal(parseDueTime(""), null);
    assert.equal(parseDueTime("25:00"), null);
  });
});

describe("nextRecurringDueAt", () => {
  it("picks later today for daily when time is still ahead", () => {
    const now = new Date("2026-08-10T14:00:00.000Z");
    const iso = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "15:00",
      timeZone: "America/Chicago",
      now,
    });
    assert.ok(iso);
    assert.equal(iso, "2026-08-10T20:00:00.000Z");
  });

  it("rolls to tomorrow for daily when time has passed", () => {
    const now = new Date("2026-08-10T21:00:00.000Z");
    const iso = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "09:00",
      timeZone: "America/Chicago",
      now,
    });
    assert.ok(iso);
    assert.equal(iso, "2026-08-11T14:00:00.000Z");
  });

  it("first instance can start today even when due clock time already passed", () => {
    // Afternoon Central (20:00 UTC = 3pm CDT on Aug 10)
    const now = new Date("2026-08-10T20:00:00.000Z");
    const first = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "09:00",
      timeZone: "America/Chicago",
      now,
      includePastOnStartDay: true,
    });
    assert.equal(first, "2026-08-10T14:00:00.000Z");

    const after = afterInstantForNextSpawn(first!);
    const next = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "09:00",
      timeZone: "America/Chicago",
      now: after,
    });
    // Completing "today" must open tomorrow — not day-after-tomorrow
    assert.equal(next, "2026-08-11T14:00:00.000Z");
  });

  it("returns null without a time", () => {
    assert.equal(
      nextRecurringDueAt({
        cadence: "daily",
        dayOfWeek: null,
        dayOfMonth: null,
        dueTime: null,
        timeZone: "America/Chicago",
      }),
      null,
    );
  });

  it("after completion of yesterday's instance, next daily is today", () => {
    const after = afterInstantForNextSpawn("2026-08-13T14:00:00.000Z");
    const iso = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "09:00",
      timeZone: "America/Chicago",
      now: after,
    });
    assert.equal(iso, "2026-08-14T14:00:00.000Z");
  });

  it("early complete still advances past that due, not a same-slot duplicate", () => {
    const after = afterInstantForNextSpawn("2026-08-13T20:00:00.000Z");
    const iso = nextRecurringDueAt({
      cadence: "daily",
      dayOfWeek: null,
      dayOfMonth: null,
      dueTime: "15:00",
      timeZone: "America/Chicago",
      now: after,
    });
    assert.equal(iso, "2026-08-14T20:00:00.000Z");
  });
});

describe("afterInstantForNextSpawn", () => {
  it("uses due + 1ms when due is present", () => {
    const d = afterInstantForNextSpawn("2026-08-13T14:00:00.000Z");
    assert.equal(d.toISOString(), "2026-08-13T14:00:00.001Z");
  });

  it("falls back to completedAt when no due", () => {
    const completedAt = new Date("2026-08-13T18:00:00.000Z");
    const d = afterInstantForNextSpawn(null, completedAt);
    assert.equal(d.toISOString(), completedAt.toISOString());
  });
});

describe("isRecurringDueMissed", () => {
  it("treats prior wall days as missed, not same-day overdue", () => {
    const now = new Date("2026-08-15T20:00:00.000Z"); // 3pm CDT Aug 15
    // Yesterday 9am CDT
    assert.equal(
      isRecurringDueMissed("2026-08-14T14:00:00.000Z", "America/Chicago", now),
      true,
    );
    // Today 9am CDT (already past clock time — still today's card)
    assert.equal(
      isRecurringDueMissed("2026-08-15T14:00:00.000Z", "America/Chicago", now),
      false,
    );
    assert.equal(isRecurringDueMissed(null, "America/Chicago", now), false);
  });

  it("compares against an explicit wall day key", () => {
    assert.equal(
      isRecurringDueBeforeWallDay(
        "2026-08-14T14:00:00.000Z",
        "America/Chicago",
        "2026-08-15",
      ),
      true,
    );
    assert.equal(
      isRecurringDueBeforeWallDay(
        "2026-08-15T14:00:00.000Z",
        "America/Chicago",
        "2026-08-15",
      ),
      false,
    );
  });
});

describe("pickOpenRecurringKeeper", () => {
  it("keeps the earliest due among open dups when no day context", () => {
    const keeper = pickOpenRecurringKeeper([
      { id: "a", due_at: "2026-08-12T14:00:00.000Z", created_at: "2026-08-12T10:00:00.000Z", status: "todo" },
      { id: "b", due_at: "2026-08-14T14:00:00.000Z", created_at: "2026-08-13T10:00:00.000Z", status: "todo" },
      { id: "c", due_at: "2026-08-13T14:00:00.000Z", created_at: "2026-08-13T11:00:00.000Z", status: "todo" },
    ]);
    assert.equal(keeper.id, "a");
  });

  it("prefers current-day open over a missed prior-day open", () => {
    const keeper = pickOpenRecurringKeeper(
      [
        {
          id: "missed",
          due_at: "2026-08-14T14:00:00.000Z",
          created_at: "2026-08-14T10:00:00.000Z",
          status: "todo",
        },
        {
          id: "today",
          due_at: "2026-08-15T14:00:00.000Z",
          created_at: "2026-08-15T10:00:00.000Z",
          status: "todo",
        },
      ],
      { todayKey: "2026-08-15", timeZone: "America/Chicago" },
    );
    assert.equal(keeper.id, "today");
  });
});

function boardTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    householdId: "hh",
    description: null,
    status: "todo",
    assigneeId: "u1",
    assigneeEmail: "a@example.com",
    assigneeLabel: "Noah",
    assigneePersona: "self_advocate",
    dueAt: null,
    reliantConfirmRequested: false,
    reliantSmsReminderRequested: false,
    provenance: {
      source: "ntrr",
      syncedAt: new Date().toISOString(),
      confidence: "high",
      lastModifiedBy: "user",
    },
    recurringTemplateId: null,
    createdBy: "u1",
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-08-14T10:00:00.000Z",
    ...partial,
  };
}

const rangeStart = "2026-08-14T05:00:00.000Z";
const rangeEnd = "2026-08-15T05:00:00.000Z";
const nowMs = Date.parse("2026-08-14T15:00:00.000Z");

describe("buildTaskBoardSections", () => {
  it("splits overdue, today, upcoming, done today, and one-off history", () => {
    const sections = buildTaskBoardSections(
      [
        boardTask({
          id: "overdue",
          title: "Late pickup",
          dueAt: "2026-08-13T14:00:00.000Z",
        }),
        boardTask({
          id: "today",
          title: "School form",
          dueAt: "2026-08-14T18:00:00.000Z",
        }),
        boardTask({
          id: "upcoming",
          title: "Morning meds",
          dueAt: "2026-08-15T14:00:00.000Z",
          recurringTemplateId: "tmpl-meds",
        }),
        boardTask({
          id: "done-today",
          title: "Brush teeth",
          status: "done",
          dueAt: "2026-08-14T12:00:00.000Z",
          updatedAt: "2026-08-14T12:30:00.000Z",
          recurringTemplateId: "tmpl-teeth",
        }),
        boardTask({
          id: "history-one-off",
          title: "Old errand",
          status: "done",
          dueAt: "2026-08-10T12:00:00.000Z",
          updatedAt: "2026-08-10T13:00:00.000Z",
        }),
        boardTask({
          id: "old-recurring-done",
          title: "Old meds done",
          status: "done",
          dueAt: "2026-08-10T12:00:00.000Z",
          updatedAt: "2026-08-10T13:00:00.000Z",
          recurringTemplateId: "tmpl-meds",
        }),
      ],
      {
        rangeStart,
        rangeEnd,
        nowMs,
        cadenceByTemplateId: { "tmpl-meds": "daily", "tmpl-teeth": "daily" },
      },
    );

    assert.deepEqual(
      sections.overdue.map((t) => t.id),
      ["overdue"],
    );
    assert.deepEqual(
      sections.today.map((t) => t.id),
      ["today"],
    );
    assert.equal(sections.upcoming[0]?.id, "upcoming");
    assert.equal(sections.upcoming[0]?.recurrenceCadence, "daily");
    assert.deepEqual(
      sections.doneToday.map((t) => t.id),
      ["done-today"],
    );
    assert.deepEqual(
      sections.history.map((t) => t.id),
      ["history-one-off"],
    );
    // Recurring old done is not history noise
    assert.ok(!sections.history.some((t) => t.id === "old-recurring-done"));
  });
});

describe("selectBoardTasks", () => {
  it("flattens active + done today without history", () => {
    const tasks = selectBoardTasks(
      [
        boardTask({
          id: "open",
          title: "Open",
          dueAt: "2026-08-14T18:00:00.000Z",
        }),
        boardTask({
          id: "history",
          title: "Old",
          status: "done",
          updatedAt: "2026-08-10T12:00:00.000Z",
        }),
        boardTask({
          id: "done-today",
          title: "Done",
          status: "done",
          updatedAt: "2026-08-14T16:00:00.000Z",
        }),
      ],
      { rangeStart, rangeEnd },
    );
    assert.ok(tasks.some((t) => t.id === "open"));
    assert.ok(tasks.some((t) => t.id === "done-today"));
    assert.ok(!tasks.some((t) => t.id === "history"));
  });
});
