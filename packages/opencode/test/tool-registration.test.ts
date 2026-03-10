import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createOpenCodeTools } from "../index.ts";

function createMockClient() {
  return {
    instance: {
      dispose: async () => true,
    },
  } as never;
}

describe("createOpenCodeTools", () => {
  test("registers Kompass tools with prefixed names", async () => {
    const tools = await createOpenCodeTools((() => {
      throw new Error("not implemented");
    }) as never, createMockClient(), process.cwd());

    assert.ok(tools.kompass_changes_load);
    assert.ok(tools.kompass_pr_load);
    assert.ok(tools.kompass_pr_review);
    assert.ok(tools.kompass_pr_sync);
    assert.ok(tools.kompass_reload);
    assert.ok(tools.kompass_ticket_load);
    assert.ok(tools.kompass_ticket_sync);
    assert.equal(tools.changes_load, undefined);
    assert.equal(tools.pr_load, undefined);
    assert.equal(tools.pr_review, undefined);
    assert.equal(tools.pr_sync, undefined);
    assert.equal(tools.reload, undefined);
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
            pr_review: { enabled: false },
            pr_sync: { enabled: false },
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
      }) as never, createMockClient(), tempDir);

      assert.ok(tools.custom_ticket_name);
      assert.ok(tools.kompass_reload);
      assert.equal(tools.kompass_ticket_sync, undefined);
      assert.deepEqual(Object.keys(tools).sort(), ["custom_ticket_name", "kompass_reload"]);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
  });
});
