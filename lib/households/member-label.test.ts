/**
 * Run with: npx tsx --test lib/households/member-label.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  displayNameFromAuthMetadata,
  humanizeEmailLocalPart,
  memberDisplayLabel,
} from "./member-label";

describe("humanizeEmailLocalPart", () => {
  it("title-cases dotted local parts", () => {
    assert.equal(humanizeEmailLocalPart("jane.doe@example.com"), "Jane Doe");
  });

  it("strips plus tags", () => {
    assert.equal(humanizeEmailLocalPart("jordan+test@hub.ntrr.com"), "Jordan");
  });

  it("handles underscores and hyphens", () => {
    assert.equal(humanizeEmailLocalPart("sam_lee-kim@x.com"), "Sam Lee Kim");
  });
});

describe("memberDisplayLabel", () => {
  it("prefers display name over email", () => {
    assert.equal(memberDisplayLabel("a@b.com", "Alex Rivera"), "Alex Rivera");
  });

  it("never returns a full email", () => {
    const label = memberDisplayLabel("alex.rivera@family.org", null);
    assert.equal(label, "Alex Rivera");
    assert.ok(!label.includes("@"));
  });
});

describe("displayNameFromAuthMetadata", () => {
  it("reads Google-style full_name", () => {
    assert.equal(displayNameFromAuthMetadata({ full_name: "Pat Lee" }), "Pat Lee");
  });

  it("combines given and family name", () => {
    assert.equal(
      displayNameFromAuthMetadata({ given_name: "Pat", family_name: "Lee" }),
      "Pat Lee",
    );
  });
});
