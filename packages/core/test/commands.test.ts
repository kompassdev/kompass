import { describe, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { resolveCommands } from "../commands/index.ts";

process.env.HOME = path.join(os.tmpdir(), `kompass-test-home-${process.pid}-core-commands`);

describe("resolveCommands", () => {
  test("includes root review config for pr/review", async () => {
    const commands = await resolveCommands(process.cwd());

    assert.deepEqual(commands["pr/review"]?.config, { enabled: true });
  });
});
