import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextRecurringDueAt, parseDueTime } from "./recurrence";
import { afterInstantForNextSpawn, pickOpenRecurringKeeper } from "./spawn-recurring";
import { selectBoardTasks } from "./queries";
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
    // 2026-08-10 14:00 UTC = 09:00 America/Chicago (CDT, UTC-5)
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
    // 15:00 CDT = 20:00 UTC
    assert.equal(iso, "2026-08-10T20:00:00.000Z");
  });

  it("rolls to tomorrow for daily when time has passed", () => {
    const now = new Date("2026-08-10T21:00:00.000Z"); // 16:00 CDT
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
    // Yesterday 09:00 CDT completed → next is today 09:00 CDT
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
    // Due 15:00 CDT; complete earlier in the day — next must be tomorrow, not today again
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

describe("pickOpenRecurringKeeper", () => {
  it("keeps the earliest due among open dups (today before tomorrow)", () => {
    const keeper = pickOpenRecurringKeeper([
      { id: "a", due_at: "2026-08-12T14:00:00.000Z", created_at: "2026-08-12T10:00:00.000Z", status: "todo" },
      { id: "b", due_at: "2026-08-14T14:00:00.000Z", created_at: "2026-08-13T10:00:00.000Z", status: "todo" },
      { id: "c", due_at: "2026-08-13T14:00:00.000Z", created_at: "2026-08-13T11:00:00.000Z", status: "todo" },
    ]);
    assert.equal(keeper.id, "a");
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

describe("selectBoardTasks", () => {
  it("shows one open card per recurring template and hides done series history", () => {
    const tasks = selectBoardTasks([
      boardTask({
        id: "done-old",
        title: "Brush teeth",
        status: "done",
        recurringTemplateId: "tmpl-teeth",
        dueAt: "2026-08-13T14:00:00.000Z",
      }),
      boardTask({
        id: "open-1",
        title: "Brush teeth",
        status: "todo",
        recurringTemplateId: "tmpl-teeth",
        dueAt: "2026-08-13T14:00:00.000Z",
        createdAt: "2026-08-13T08:00:00.000Z",
      }),
      boardTask({
        id: "open-2",
        title: "Brush teeth",
        status: "todo",
        recurringTemplateId: "tmpl-teeth",
        dueAt: "2026-08-14T14:00:00.000Z",
        createdAt: "2026-08-14T08:00:00.000Z",
      }),
      boardTask({
        id: "one-off",
        title: "Call dentist",
        status: "todo",
      }),
    ]);

    assert.equal(tasks.length, 2);
    assert.ok(tasks.some((t) => t.id === "one-off"));
    // Earliest open due wins (open-1 before open-2) so today is not dropped for tomorrow
    assert.ok(tasks.some((t) => t.id === "open-1"));
    assert.ok(!tasks.some((t) => t.id === "done-old"));
    assert.ok(!tasks.some((t) => t.id === "open-2"));
  });
});
