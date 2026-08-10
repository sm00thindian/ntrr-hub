/**
 * Pure ranking unit tests — run with: npx tsx --test lib/dashboard/needs-attention.test.ts
 * (or npm run test:unit)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankNeedsAttention } from "./needs-attention";
import type { Task } from "../tasks/types";

function task(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    householdId: "hh",
    description: null,
    status: "todo",
    assigneeId: "user-1",
    assigneeEmail: "a@example.com",
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
