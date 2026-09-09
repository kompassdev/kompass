import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("plugin entry", () => {
  test("exposes one dual-version plugin definition", async () => {
    const mod = await import("../plugin.ts");

    assert.deepEqual(
      Object.keys(mod).sort(),
      [
        "OpenCodeCompassPlugin",
        "OpenCodeCompassPluginV1",
        "OpenCodeCompassPluginV2",
        "default",
        "setupOpenCodeV2",
      ],
    );
    assert.equal(mod.default, mod.OpenCodeCompassPlugin);
    assert.equal(mod.default.server, mod.OpenCodeCompassPluginV1);
    assert.equal(mod.default.effect, mod.OpenCodeCompassPluginV2.effect);
    assert.equal(mod.default.id, "kompass");
    assert.equal(typeof mod.OpenCodeCompassPluginV2.effect, "function");
  });
});
