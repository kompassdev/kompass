import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createOpenCodeTools } from "../index.ts";

describe("createOpenCodeTools", () => {
  test("registers Kompass tools with prefixed names", async () => {
    const tools = await createOpenCodeTools((() => {
      throw new Error("not implemented");
    }) as never, process.cwd());

    assert.ok(tools.kompass_changes_load);
    assert.ok(tools.kompass_pr_load);
    assert.ok(tools.kompass_ticket_load);
    assert.ok(tools.kompass_ticket_sync);
    assert.equal(tools.changes_load, undefined);
    assert.equal(tools.pr_load, undefined);
    assert.equal(tools.ticket_load, undefined);
    assert.equal(tools.ticket_sync, undefined);
  });

  test("registers configured tool aliases instead of default prefixed names", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-"));

    try {
      await writeFile(
        path.join(tempDir, "kompass.json"),
        JSON.stringify({
          tools: {
            changes_load: { enabled: false },
            pr_load: { enabled: false },
            ticket_sync: {
              enabled: true,
              name: "custom_ticket_name",
            },
            ticket_load: { enabled: false },
          },
        }),
      );

      const tools = await createOpenCodeTools((() => {
        throw new Error("not implemented");
      }) as never, tempDir);

      assert.ok(tools.custom_ticket_name);
      assert.equal(tools.kompass_ticket_sync, undefined);
      assert.deepEqual(Object.keys(tools), ["custom_ticket_name"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
