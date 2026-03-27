import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("plugin entry", () => {
  test("only exposes plugin factories", async () => {
    const mod = await import("../plugin.ts");

    assert.deepEqual(
      Object.keys(mod).sort(),
      ["OpenCodeCompassPlugin", "default"],
    );
    assert.equal(mod.default, mod.OpenCodeCompassPlugin);
  });
});
