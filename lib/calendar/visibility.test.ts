/**
 * Run with: npx tsx --test lib/calendar/visibility.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HouseholdCalendarSettings } from "@/lib/calendar/colors";
import type { Provenance } from "@/lib/provenance/types";
import {
  eventIsHouseholdShared,
  eventVisibleToUser,
  filterEventsForViewer,
  filterHouseholdCalendarEvents,
  normalizeGoogleCalendarAssignments,
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

const advocate = "adv-1";
const caregiver = "care-1";
const realPrimary = "advocate@gmail.com";

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

describe("eventVisibleToUser — personal privacy (ADR 0002)", () => {
  const personalSettings: HouseholdCalendarSettings = {
    googleCalendars: {
      [realPrimary]: {
        memberUserId: advocate,
        color: "#8E24AA",
        visibility: "personal",
      },
      "family-shared": {
        memberUserId: caregiver,
        color: "#00C853",
        visibility: "household",
      },
    },
  };

  it("hides self-advocate personal calendar from caregiver", () => {
    assert.equal(
      eventVisibleToUser(event(realPrimary), caregiver, personalSettings),
      false,
    );
  });

  it("shows self-advocate personal calendar to self-advocate", () => {
    assert.equal(
      eventVisibleToUser(event(realPrimary), advocate, personalSettings),
      true,
    );
  });

  it("shows household shared calendars to caregiver", () => {
    assert.equal(
      eventVisibleToUser(event("family-shared"), caregiver, personalSettings),
      true,
    );
  });

  it("resolves personal when event still has primary alias", () => {
    // Settings keyed by real primary id; legacy event provenance uses "primary"
    assert.equal(
      eventVisibleToUser(event("primary"), caregiver, personalSettings, {
        googlePrimaryIds: [realPrimary],
      }),
      false,
    );
    assert.equal(
      eventVisibleToUser(event("primary"), advocate, personalSettings, {
        googlePrimaryIds: [realPrimary],
      }),
      true,
    );
  });

  it("resolves personal when settings only stored under primary alias", () => {
    const aliasSettings: HouseholdCalendarSettings = {
      googleCalendars: {
        primary: {
          memberUserId: advocate,
          color: "#8E24AA",
          visibility: "personal",
        },
      },
    };
    assert.equal(
      eventVisibleToUser(event(realPrimary), caregiver, aliasSettings, {
        googlePrimaryIds: [realPrimary],
      }),
      false,
    );
    assert.equal(
      eventVisibleToUser(event(realPrimary), advocate, aliasSettings, {
        googlePrimaryIds: [realPrimary],
      }),
      true,
    );
  });

  it("filters Apple personal calendars", () => {
    const appleSettings: HouseholdCalendarSettings = {
      appleCalendars: {
        "apple:int-1": {
          memberUserId: advocate,
          color: "#FB8C00",
          visibility: "personal",
        },
      },
    };
    assert.equal(
      eventVisibleToUser(event("apple:int-1"), caregiver, appleSettings),
      false,
    );
    assert.equal(
      eventVisibleToUser(event("apple:int-1"), advocate, appleSettings),
      true,
    );
  });
});

describe("normalizeGoogleCalendarAssignments", () => {
  it("mirrors primary personal assignment onto real primary id", () => {
    const normalized = normalizeGoogleCalendarAssignments(
      {
        primary: {
          memberUserId: advocate,
          color: "#8E24AA",
          visibility: "personal",
        },
      },
      [realPrimary],
    );
    assert.equal(normalized.primary, undefined);
    assert.equal(normalized[realPrimary]?.visibility, "personal");
    assert.equal(normalized[realPrimary]?.memberUserId, advocate);
  });

  it("lets personal under primary win over default household on real id", () => {
    const normalized = normalizeGoogleCalendarAssignments(
      {
        primary: {
          memberUserId: advocate,
          color: "#8E24AA",
          visibility: "personal",
        },
        [realPrimary]: {
          memberUserId: advocate,
          color: "#00C853",
          visibility: "household",
        },
      },
      [realPrimary],
    );
    assert.equal(normalized[realPrimary]?.visibility, "personal");
  });
});

describe("filterEventsForViewer", () => {
  it("drops personal events for other members", () => {
    const personalSettings: HouseholdCalendarSettings = {
      googleCalendars: {
        [realPrimary]: {
          memberUserId: advocate,
          color: "#8E24AA",
          visibility: "personal",
        },
        "family-shared": {
          memberUserId: caregiver,
          color: "#00C853",
          visibility: "household",
        },
      },
    };
    const list = filterEventsForViewer(
      [event(realPrimary), event("family-shared"), event("primary")],
      caregiver,
      personalSettings,
      { googlePrimaryIds: [realPrimary] },
    );
    assert.deepEqual(
      list.map((e) => e.provenance.calendarId),
      ["family-shared"],
    );
  });
});
