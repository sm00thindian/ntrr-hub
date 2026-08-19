import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isReliantBridgeEnabled, reliantIntentNotAllowedMessage } from "@/lib/reliant/constants";

describe("isReliantBridgeEnabled", () => {
  it("is false when unset", () => {
    const prev = process.env.RELIANT_BRIDGE_ENABLED;
    const prevPublic = process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED;
    delete process.env.RELIANT_BRIDGE_ENABLED;
    delete process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED;
    try {
      assert.equal(isReliantBridgeEnabled(), false);
    } finally {
      if (prev === undefined) delete process.env.RELIANT_BRIDGE_ENABLED;
      else process.env.RELIANT_BRIDGE_ENABLED = prev;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED;
      else process.env.NEXT_PUBLIC_RELIANT_BRIDGE_ENABLED = prevPublic;
    }
  });

  it("is true for true/1", () => {
    const prev = process.env.RELIANT_BRIDGE_ENABLED;
    process.env.RELIANT_BRIDGE_ENABLED = "true";
    try {
      assert.equal(isReliantBridgeEnabled(), true);
      process.env.RELIANT_BRIDGE_ENABLED = "1";
      assert.equal(isReliantBridgeEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.RELIANT_BRIDGE_ENABLED;
      else process.env.RELIANT_BRIDGE_ENABLED = prev;
    }
  });
});

describe("reliantIntentNotAllowedMessage", () => {
  it("mentions ENV when disabled", () => {
    assert.match(
      reliantIntentNotAllowedMessage({ enabled: false, coordinatorConnected: false }),
      /not enabled/i,
    );
  });

  it("mentions Settings when enabled but not connected", () => {
    assert.match(
      reliantIntentNotAllowedMessage({ enabled: true, coordinatorConnected: false }),
      /Settings/i,
    );
  });
});
