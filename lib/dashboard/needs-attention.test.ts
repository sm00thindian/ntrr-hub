/**
 * Pure ranking unit tests — run with: npx tsx --test lib/dashboard/needs-attention.test.ts
 * (or npm run test:unit)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCaregiverFocusToday,
  rankNeedsAttention,
  rankTomorrowPreview,
} from "./needs-attention";
import type { Task } from "../tasks/types";

function task(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    householdId: "hh",
    description: null,
    status: "todo",
    assigneeId: "user-1",
    assigneeEmail: "a@example.com",
    assigneeLabel: "Alex",
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
    createdBy: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

const rangeStart = "2026-08-10T05:00:00.000Z";
const nowMs = Date.parse("2026-08-10T15:00:00.000Z");

describe("rankNeedsAttention", () => {
  it("ranks conflicts first", () => {
    const items = rankNeedsAttention({
      tasks: [
        task({
          id: "t1",
          title: "Overdue meds",
          dueAt: "2026-08-09T12:00:00.000Z",
        }),
      ],
      events: [],
      conflictCount: 2,
      nowMs,
      rangeStart,
    });

    assert.equal(items[0]?.reason, "conflict");
    assert.match(items[0]?.title ?? "", /2 sync conflicts/);
  });

  it("ranks overdue before unassigned", () => {
    const items = rankNeedsAttention({
      tasks: [
        task({
          id: "u1",
          title: "Unassigned chore",
          assigneeId: null,
          assigneeEmail: null,
          assigneeLabel: null,
          assigneePersona: null,
        }),
        task({
          id: "o1",
          title: "Overdue pickup",
          dueAt: "2026-08-09T12:00:00.000Z",
        }),
      ],
      events: [],
      conflictCount: 0,
      nowMs,
      rangeStart,
    });

    assert.equal(items[0]?.reason, "overdue");
    assert.equal(items[1]?.reason, "unassigned");
  });

  it("includes due-soon tasks within 4 hours", () => {
    const items = rankNeedsAttention({
      tasks: [
        task({
          id: "s1",
          title: "Soon",
          dueAt: "2026-08-10T17:00:00.000Z", // 2h after now
        }),
      ],
      events: [],
      conflictCount: 0,
      nowMs,
      rangeStart,
    });

    assert.equal(items[0]?.reason, "due_soon");
  });

  it("respects limit", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      task({
        id: `t${i}`,
        title: `Task ${i}`,
        dueAt: "2026-08-09T12:00:00.000Z",
      }),
    );
    const items = rankNeedsAttention({
      tasks,
      events: [],
      conflictCount: 0,
      nowMs,
      rangeStart,
      limit: 3,
    });
    assert.equal(items.length, 3);
  });
});

const rangeEnd = "2026-08-11T05:00:00.000Z";
const tomorrowStart = "2026-08-11T05:00:00.000Z";
const tomorrowEnd = "2026-08-12T05:00:00.000Z";

describe("buildCaregiverFocusToday", () => {
  it("puts conflicts and overdue before chronological day items", () => {
    const items = buildCaregiverFocusToday({
      tasks: [
        task({
          id: "later",
          title: "Afternoon chore",
          dueAt: "2026-08-10T20:00:00.000Z",
        }),
        task({
          id: "over",
          title: "Overdue meds",
          dueAt: "2026-08-09T12:00:00.000Z",
        }),
      ],
      events: [
        {
          id: "event-1",
          kind: "event",
          title: "School pickup",
          sortAt: "2026-08-10T18:00:00.000Z",
          source: "google",
          href: "/calendar",
        },
      ],
      conflictCount: 1,
      nowMs,
      rangeStart,
      rangeEnd,
    });

    assert.equal(items[0]?.reason, "conflict");
    assert.equal(items[1]?.reason, "overdue");
    assert.ok(items.some((i) => i.title === "School pickup" && i.reason === "calendar"));
    assert.ok(items.some((i) => i.title === "Afternoon chore"));
  });

  it("includes household events for the full day, not only due-soon", () => {
    const items = buildCaregiverFocusToday({
      tasks: [],
      events: [
        {
          id: "event-evening",
          kind: "event",
          title: "Evening practice",
          sortAt: "2026-08-10T23:00:00.000Z",
          source: "google",
        },
      ],
      conflictCount: 0,
      nowMs,
      rangeStart,
      rangeEnd,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.reason, "calendar");
  });

  it("shows open recurring due tomorrow so daily care does not vanish from Focus", () => {
    const items = buildCaregiverFocusToday({
      tasks: [
        task({
          id: "next",
          title: "Morning meds",
          status: "todo",
          dueAt: "2026-08-11T14:00:00.000Z",
          recurringTemplateId: "tmpl-meds",
        }),
      ],
      events: [],
      conflictCount: 0,
      nowMs,
      rangeStart,
      rangeEnd,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.status, "todo");
    assert.notEqual(items[0]?.reason, "done");
  });

  it("does not list completed tasks on Focus", () => {
    const items = buildCaregiverFocusToday({
      tasks: [
        task({
          id: "finished",
          title: "Finished meds",
          status: "done",
          dueAt: "2026-08-10T14:00:00.000Z",
          updatedAt: "2026-08-10T15:30:00.000Z",
        }),
      ],
      events: [],
      conflictCount: 0,
      nowMs,
      rangeStart,
      rangeEnd,
    });
    assert.equal(items.length, 0);
  });
});

describe("rankTomorrowPreview", () => {
  it("includes only non-recurring open tasks on the next day", () => {
    const { items, overflow } = rankTomorrowPreview({
      tasks: [
        task({
          id: "today",
          title: "Today only",
          dueAt: "2026-08-10T18:00:00.000Z",
        }),
        task({
          id: "tm1",
          title: "Tomorrow pickup",
          dueAt: "2026-08-11T14:00:00.000Z",
          assigneeLabel: "Noah",
        }),
        task({
          id: "recurring-meds",
          title: "Morning meds",
          dueAt: "2026-08-11T13:00:00.000Z",
          recurringTemplateId: "tmpl-meds",
        }),
        task({
          id: "done",
          title: "Done tomorrow",
          status: "done",
          dueAt: "2026-08-11T10:00:00.000Z",
        }),
      ],
      rangeStart: tomorrowStart,
      rangeEnd: tomorrowEnd,
    });

    assert.equal(overflow, 0);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Tomorrow pickup");
    assert.equal(items[0]?.assigneeLabel, "Noah");
  });

  it("ignores calendar events — Focus tomorrow is one-off tasks only", () => {
    const { items } = rankTomorrowPreview({
      tasks: [
        task({
          id: "t1",
          title: "Dentist form",
          dueAt: "2026-08-11T12:00:00.000Z",
        }),
      ],
      events: [
        {
          id: "event-all",
          kind: "event",
          title: "All-day trip",
          sortAt: "2026-08-11T05:00:00.000Z",
          allDay: true,
          source: "google",
        },
      ],
      rangeStart: tomorrowStart,
      rangeEnd: tomorrowEnd,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Dentist form");
  });

  it("caps list and reports overflow", () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      task({
        id: `t${i}`,
        title: `Task ${i}`,
        dueAt: `2026-08-11T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const { items, overflow } = rankTomorrowPreview({
      tasks,
      rangeStart: tomorrowStart,
      rangeEnd: tomorrowEnd,
      limit: 3,
    });
    assert.equal(items.length, 3);
    assert.equal(overflow, 2);
  });
});
