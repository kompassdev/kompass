import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { resolveCommands } from "../commands/index.ts";

describe("resolveCommands", () => {
  test("includes default config for pr/review", async () => {
    const commands = await resolveCommands(process.cwd());

    assert.deepEqual(commands["pr/review"]?.config, { enabled: true, approve: false });
  });
});
