/**
 * Run with: npx tsx --test lib/calendar/visibility.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HouseholdCalendarSettings } from "@/lib/calendar/colors";
import type { Provenance } from "@/lib/provenance/types";
import {
  eventIsHouseholdShared,
  filterHouseholdCalendarEvents,
} from "./visibility";

function event(calendarId: string | undefined) {
  return {
    id: calendarId ?? "none",
    provenance: {
      source: "google" as const,
      syncedAt: new Date().toISOString(),
      confidence: "high" as const,
      lastModifiedBy: "sync" as const,
      calendarId,
    } satisfies Provenance,
  };
}

const settings: HouseholdCalendarSettings = {
  googleCalendars: {
    "family-cal": {
      memberUserId: "coord-1",
      color: "#00C853",
      visibility: "household",
    },
    "private-cal": {
      memberUserId: "coord-1",
      color: "#1E88E5",
      visibility: "personal",
    },
  },
};

describe("eventIsHouseholdShared", () => {
  it("includes household calendars", () => {
    assert.equal(eventIsHouseholdShared(event("family-cal"), settings), true);
  });

  it("excludes personal calendars even for the owner", () => {
    assert.equal(eventIsHouseholdShared(event("private-cal"), settings), false);
  });

  it("treats missing assignment as household (legacy)", () => {
    assert.equal(eventIsHouseholdShared(event("unknown-cal"), settings), true);
    assert.equal(eventIsHouseholdShared(event(undefined), settings), true);
  });
});

describe("filterHouseholdCalendarEvents", () => {
  it("keeps only household shared events", () => {
    const list = filterHouseholdCalendarEvents(
      [event("family-cal"), event("private-cal"), event("unknown-cal")],
      settings,
    );
    assert.deepEqual(
      list.map((e) => e.provenance.calendarId),
      ["family-cal", "unknown-cal"],
    );
  });
});
