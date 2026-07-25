import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createOpenCodeTools, OpenCodeCompassPlugin } from "../index.ts";

const execFileAsync = promisify(execFile);

type MockLogEntry = {
  query?: { directory?: string };
  body?: { level?: string; message?: string; extra?: Record<string, unknown> };
};

type MockClient = {
  logs: MockLogEntry[];
  sessionCommands: Array<Record<string, unknown>>;
  sessionPrompts: Array<Record<string, unknown>>;
  sessionPromptAsyncs: Array<Record<string, unknown>>;
  app: {
    log(entry: MockLogEntry): Promise<boolean>;
  };
  session: {
    command(options: Record<string, unknown>): Promise<Record<string, unknown>>;
    prompt(options: Record<string, unknown>): Promise<Record<string, unknown>>;
    promptAsync(options: Record<string, unknown>): Promise<Record<string, unknown>>;
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
  const sessionCommands: Array<Record<string, unknown>> = [];
  const sessionPrompts: Array<Record<string, unknown>> = [];
  const sessionPromptAsyncs: Array<Record<string, unknown>> = [];

  function response(text: string, id: string) {
    return {
      data: {
        info: { id },
        parts: [{ type: "text", text }],
      },
      error: undefined,
      request: new Request("http://localhost/mock"),
      response: new Response(),
    };
  }

  return {
    logs,
    sessionCommands,
    sessionPrompts,
    sessionPromptAsyncs,
    app: {
      log: async (entry: (typeof logs)[number]) => {
        logs.push(entry);
        return true;
      },
    },
    session: {
      command: async (options: Record<string, unknown>) => {
        sessionCommands.push(options);
        const body = (options.body ?? {}) as { command?: string; arguments?: string };
        return response(`Ran /${body.command ?? "unknown"} ${body.arguments ?? ""}`.trim(), "assistant-command");
      },
      prompt: async (options: Record<string, unknown>) => {
        sessionPrompts.push(options);
        const parts = ((options.body ?? {}) as { parts?: Array<{ text?: string }> }).parts ?? [];
        const text = parts.map((part) => part.text ?? "").join("\n").trim();
        return response(text, "assistant-prompt");
      },
      promptAsync: async (options: Record<string, unknown>) => {
        sessionPromptAsyncs.push(options);
        return {
          data: undefined,
          error: undefined,
          request: new Request("http://localhost/mock"),
          response: new Response(null, { status: 204 }),
        };
      },
    },
    instance: {
      dispose: async () => true,
    },
  };
}

async function git(cwd: string, args: string[]) {
  await execFileAsync("git", args, { cwd });
}

async function createTempGitRepo() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-tools-git-"));

  await git(tempDir, ["init", "-b", "main"]);
  await git(tempDir, ["config", "user.email", "test@example.com"]);
  await git(tempDir, ["config", "user.name", "Test User"]);
  await writeFile(path.join(tempDir, "README.md"), "test\n");
  await git(tempDir, ["add", "README.md"]);
  await git(tempDir, ["commit", "-m", "initial"]);

  return tempDir;
}

describe("createOpenCodeTools", () => {
  test("keeps Navigator disabled by default", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools(createMockClient() as never, process.cwd());
      assert.equal(tools.kompass_session_create, undefined);
      assert.equal(tools.kompass_worktree_list, undefined);
    });
  });

  test("registers all Navigator tools when enabled and preserves aliases and disables", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-navigator-tools-"));
      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(path.join(tempDir, ".opencode", "kompass.jsonc"), `{
          "adapters": { "opencode": { "navigator": { "enabled": true } } },
          "tools": {
            "session_create": { "name": "delegate_session" },
            "session_interrupt": { "enabled": false }
          }
        }`);
        const navigatorClient = {
          worktree: { list() {}, create() {}, remove() {} },
          v2: { session: {
            create() {}, list() {}, get() {}, messages() {}, prompt() {}, active() {}, wait() {}, interrupt() {},
          } },
        };
        const tools = await createOpenCodeTools(createMockClient() as never, tempDir, {
          client: navigatorClient as never,
          projectID: "project-1",
        });

        assert.ok(tools.kompass_worktree_list);
        assert.ok(tools.delegate_session);
        assert.ok(tools.kompass_session_list);
        assert.ok(tools.kompass_session_read);
        assert.ok(tools.kompass_session_send);
        assert.ok(tools.kompass_session_wait);
        assert.ok(tools.kompass_worktree_remove);
        assert.equal(tools.kompass_session_create, undefined);
        assert.equal(tools.kompass_session_interrupt, undefined);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("registers Kompass tools with prefixed names", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools(createMockClient() as never, process.cwd());

      assert.ok(tools.kompass_changes_load);
      assert.ok(tools.kompass_pr_load);
      assert.ok(tools.kompass_pr_load_review);
      assert.ok(tools.kompass_pr_sync);
      assert.ok(tools.kompass_ticket_load);
      assert.ok(tools.kompass_ticket_sync);
      assert.equal(tools.changes_load, undefined);
      assert.equal(tools.pr_load, undefined);
      assert.equal(tools.pr_load_review, undefined);
      assert.equal(tools.pr_sync, undefined);
      assert.equal(tools.ticket_load, undefined);
      assert.equal(tools.ticket_sync, undefined);
    });
  });

  test("runs shell tools with the Kompass shell runner", async () => {
    await withTempHome(async () => {
      const tempDir = await createTempGitRepo();

      try {
        const tools = await createOpenCodeTools(createMockClient() as never, tempDir);
        const output = await (tools.kompass_changes_load as any).execute(
          { base: "HEAD" },
          {
            directory: tempDir,
            worktree: tempDir,
          },
        );

        assert.deepEqual(JSON.parse(output).files, []);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
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
              "pr_load_review": { "enabled": false },
              "pr_sync": { "enabled": false },
              "ticket_sync": {
                "enabled": true,
                "name": "custom_ticket_name"
              },
              "ticket_load": { "enabled": false }
            }
          }`,
        );

        const tools = await createOpenCodeTools(createMockClient() as never, tempDir);

        assert.ok(tools.custom_ticket_name);
        assert.equal(tools.kompass_ticket_sync, undefined);
        assert.deepEqual(Object.keys(tools).sort(), ["custom_ticket_name"]);
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

        const tools = await createOpenCodeTools(createMockClient() as never, tempDir);

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
        const tools = await createOpenCodeTools(createMockClient() as never, tempDir);

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

        const tools = await createOpenCodeTools(createMockClient() as never, tempDir);

        const reviewShape = (tools.kompass_pr_sync as any).args.review.unwrap().shape;
        assert.ok(reviewShape.approve);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("exposes ticket assignees and comments, and PR assignees", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools(createMockClient() as never, process.cwd());

      const prSyncArgs = (tools.kompass_pr_sync as any).args;
      const ticketSyncArgs = (tools.kompass_ticket_sync as any).args;
      assert.ok(prSyncArgs.assignees);
      assert.ok(ticketSyncArgs.assignees);
      assert.ok(ticketSyncArgs.comments);
      assert.equal(ticketSyncArgs.title.isOptional(), true);
    });
  });

  test("plugin registers shell-backed tools that execute in the worktree", async () => {
    await withTempHome(async () => {
      const tempDir = await createTempGitRepo();

      try {
        const plugin = await OpenCodeCompassPlugin({
          client: createMockClient() as never,
          directory: tempDir,
          worktree: tempDir,
        } as never);

        const output = await (plugin.tool?.kompass_changes_load as any).execute(
          { base: "HEAD" },
          {
            directory: tempDir,
            worktree: tempDir,
          },
        );

        assert.deepEqual(JSON.parse(output).files, []);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

});
