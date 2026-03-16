import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createOpenCodeTools } from "../index.ts";

function createMockClient() {
  return {
    app: {
      log: async () => true,
    },
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
    assert.ok(tools.kompass_pr_sync);
    assert.ok(tools.kompass_reload);
    assert.ok(tools.kompass_ticket_load);
    assert.ok(tools.kompass_ticket_sync);
    assert.equal(tools.changes_load, undefined);
    assert.equal(tools.pr_load, undefined);
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

  test("loads tool aliases from jsonc config", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-jsonc-"));

    try {
      await writeFile(
        path.join(tempDir, "kompass.jsonc"),
        `{
          // jsonc config should work
          "tools": {
            "pr_load": {
              "enabled": true,
              "name": "pull_request_context",
            },
          },
        }`,
      );

      const tools = await createOpenCodeTools((() => {
        throw new Error("not implemented");
      }) as never, createMockClient(), tempDir);

      assert.ok(tools.pull_request_context);
      assert.equal(tools.kompass_pr_load, undefined);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("hides review.approve when pr/review approval is disabled", async () => {
    const tools = await createOpenCodeTools((() => {
      throw new Error("not implemented");
    }) as never, createMockClient(), process.cwd());

    const reviewShape = (tools.kompass_pr_sync as any).args.review.unwrap().shape;
    assert.equal(reviewShape.approve, undefined);
  });

  test("includes review.approve when pr/review approval is enabled", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-approve-"));

    try {
      await writeFile(
        path.join(tempDir, "kompass.jsonc"),
        `{
          "shared": {
            "prApprove": true
          }
        }`,
      );

      const tools = await createOpenCodeTools((() => {
        throw new Error("not implemented");
      }) as never, createMockClient(), tempDir);

      const reviewShape = (tools.kompass_pr_sync as any).args.review.unwrap().shape;
      assert.ok(reviewShape.approve);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
