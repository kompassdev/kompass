import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createOpenCodeTools, OpenCodeCompassPlugin } from "../index.ts";

type MockLogEntry = {
  query?: { directory?: string };
  body?: { level?: string; message?: string; extra?: Record<string, unknown> };
};

type MockClient = {
  logs: MockLogEntry[];
  app: {
    log(entry: MockLogEntry): Promise<boolean>;
  };
  instance: {
    dispose(): Promise<boolean>;
  };
};

const originalHome = process.env.HOME;

async function withTempHome<T>(run: (homeDir: string) => Promise<T>): Promise<T> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-home-"));

  process.env.HOME = homeDir;

  try {
    return await run(homeDir);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
}

function createMockClient(): MockClient {
  const logs: MockLogEntry[] = [];

  return {
    logs,
    app: {
      log: async (entry: (typeof logs)[number]) => {
        logs.push(entry);
        return true;
      },
    },
    instance: {
      dispose: async () => true,
    },
  };
}

describe("createOpenCodeTools", () => {
  test("registers Kompass tools with prefixed names", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools((() => {
        throw new Error("not implemented");
      }) as never, createMockClient() as never, process.cwd());

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
  });

  test("registers configured tool aliases instead of default prefixed names", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "tools": {
              "changes_load": { "enabled": false },
              "pr_load": { "enabled": false },
              "pr_sync": { "enabled": false },
              "ticket_sync": {
                "enabled": true,
                "name": "custom_ticket_name"
              },
              "ticket_load": { "enabled": false }
            }
          }`,
        );

        const tools = await createOpenCodeTools((() => {
          throw new Error("not implemented");
        }) as never, createMockClient() as never, tempDir);

        assert.ok(tools.custom_ticket_name);
        assert.ok(tools.kompass_reload);
        assert.equal(tools.kompass_ticket_sync, undefined);
        assert.deepEqual(Object.keys(tools).sort(), ["custom_ticket_name", "kompass_reload"]);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("loads tool aliases from jsonc config", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-jsonc-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
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
        }) as never, createMockClient() as never, tempDir);

        assert.ok(tools.pull_request_context);
        assert.equal(tools.kompass_pr_load, undefined);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("hides review.approve when pr/review approval is disabled", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-no-approve-"));

      try {
        const tools = await createOpenCodeTools((() => {
          throw new Error("not implemented");
        }) as never, createMockClient() as never, tempDir);

        const reviewShape = (tools.kompass_pr_sync as any).args.review.unwrap().shape;
        assert.equal(reviewShape.approve, undefined);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("includes review.approve when pr/review approval is enabled", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-approve-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true
            }
          }`,
        );

        const tools = await createOpenCodeTools((() => {
          throw new Error("not implemented");
        }) as never, createMockClient() as never, tempDir);

        const reviewShape = (tools.kompass_pr_sync as any).args.review.unwrap().shape;
        assert.ok(reviewShape.approve);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("exposes ticket assignees and comments, and PR assignees", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools((() => {
        throw new Error("not implemented");
      }) as never, createMockClient() as never, process.cwd());

      const prSyncArgs = (tools.kompass_pr_sync as any).args;
      const ticketSyncArgs = (tools.kompass_ticket_sync as any).args;
      assert.ok(prSyncArgs.assignees);
      assert.ok(ticketSyncArgs.assignees);
      assert.ok(ticketSyncArgs.comments);
      assert.equal(ticketSyncArgs.title.isOptional(), true);
    });
  });

  test("observes slash-command expansion failures without throwing", async () => {
    await withTempHome(async () => {
      const client = createMockClient();
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-bad-config-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true,
          }`,
        );

        const plugin = await OpenCodeCompassPlugin({
          $: (() => {
            throw new Error("not implemented");
          }) as never,
          client: client as never,
          directory: tempDir,
          worktree: tempDir,
        } as never);

        const output = {
          args: {
            prompt: "/review auth bug",
            command: "/review auth bug",
          },
        };

        await plugin["tool.execute.before"]?.(
          {
            tool: "task",
            sessionID: "session-1",
            callID: "call-1",
          } as never,
          output as never,
        );

        assert.equal(output.args.prompt, "/review auth bug");
        assert.ok(client.logs.some((entry) => entry.body?.message?.includes("Skipping Kompass tool registration")));
        assert.ok(client.logs.some((entry) => entry.body?.message?.includes("Failed to expand slash command for task tool")));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

});
