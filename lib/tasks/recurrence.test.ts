import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextRecurringDueAt, parseDueTime } from "./recurrence";

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
});
