import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLegendEntries,
  resolveMemberChipColor,
  type CalendarColorContext,
} from "@/lib/calendar/colors";

function context(partial?: Partial<CalendarColorContext>): CalendarColorContext {
  return {
    memberColors: {
      coord: "#00C853",
      noah: "#1E88E5",
    },
    googleCalendars: {
      primary: { memberUserId: "coord", color: "#69F0AE", visibility: "household" },
    },
    appleCalendars: {},
    members: [
      { userId: "coord", label: "Coordinator" },
      { userId: "noah", label: "Noah" },
    ],
    selectedCalendarIds: ["primary"],
    calendarNames: { primary: "Family" },
    viewerUserId: "coord",
    ...partial,
  };
}

describe("resolveMemberChipColor", () => {
  it("returns normalized color for a known member", () => {
    assert.equal(
      resolveMemberChipColor("noah", { noah: "#1E88E5", coord: "#00C853" }),
      "#1E88E5",
    );
  });

  it("returns undefined for unassigned or unknown members", () => {
    assert.equal(resolveMemberChipColor(null, { noah: "#1E88E5" }), undefined);
    assert.equal(resolveMemberChipColor("missing", { noah: "#1E88E5" }), undefined);
    assert.equal(resolveMemberChipColor("noah", undefined), undefined);
  });

  it("rejects invalid hex values", () => {
    assert.equal(resolveMemberChipColor("noah", { noah: "blue" }), undefined);
    assert.equal(resolveMemberChipColor("noah", { noah: "#fff" }), undefined);
  });
});

describe("buildLegendEntries", () => {
  it("includes every household member, even without a calendar or tasks", () => {
    const entries = buildLegendEntries(context());
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((e) => e.member.label),
      ["Coordinator", "Noah"],
    );
    assert.equal(entries[0]!.calendars.length, 1);
    assert.equal(entries[1]!.calendars.length, 0);
    assert.equal(entries[1]!.color, "#1E88E5");
  });

  it("nests shared calendars under their assignee and personal only under the viewer", () => {
    const entries = buildLegendEntries(
      context({
        selectedCalendarIds: ["primary", "work", "secret", "apple:1"],
        googleCalendars: {
          primary: { memberUserId: "coord", color: "#69F0AE", visibility: "household" },
          work: { memberUserId: "coord", color: "#82B1FF", visibility: "household" },
          secret: { memberUserId: "noah", color: "#FFD180", visibility: "personal" },
        },
        appleCalendars: {
          "apple:1": { memberUserId: "coord", color: "#EA80FC", visibility: "personal" },
        },
        calendarNames: {
          primary: "Family",
          work: "Work",
          secret: "Noah private",
          "apple:1": "My Apple",
        },
        viewerUserId: "coord",
      }),
    );

    const coord = entries.find((e) => e.member.userId === "coord")!;
    const noah = entries.find((e) => e.member.userId === "noah")!;

    assert.deepEqual(
      coord.calendars.map((c) => c.calendarId).sort(),
      ["apple:1", "primary", "work"],
    );
    // Noah's personal calendar is hidden from the coordinator's legend
    assert.equal(noah.calendars.length, 0);
  });

  it("shows the viewer's own personal calendars under them", () => {
    const entries = buildLegendEntries(
      context({
        selectedCalendarIds: ["secret"],
        googleCalendars: {
          secret: { memberUserId: "noah", color: "#FFD180", visibility: "personal" },
        },
        calendarNames: { secret: "Noah private" },
        viewerUserId: "noah",
      }),
    );
    const noah = entries.find((e) => e.member.userId === "noah")!;
    assert.equal(noah.calendars.length, 1);
    assert.equal(noah.calendars[0]!.visibility, "personal");
  });
});
