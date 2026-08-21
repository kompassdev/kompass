import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createOpenCodeTools, OpenCodeCompassPlugin } from "../index.ts";

const execFileAsync = promisify(execFile);
const originalHome = process.env.HOME;

async function withTempHome<T>(run: () => Promise<T>): Promise<T> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "kompass-v2-home-"));
  process.env.HOME = homeDir;
  try {
    return await run();
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await rm(homeDir, { recursive: true, force: true });
  }
}

async function createTempGitRepo() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kompass-v2-git-"));
  await execFileAsync("git", ["init", "-b", "main"], { cwd: directory });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: directory });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: directory });
  await writeFile(path.join(directory, "README.md"), "test\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: directory });
  await execFileAsync("git", ["commit", "-m", "initial"], { cwd: directory });
  return directory;
}

describe("OpenCode v2 tools", () => {
  test("registers the six supported tools with direct provider exposure", async () => {
    await withTempHome(async () => {
      const tools = await createOpenCodeTools(process.cwd());
      assert.deepEqual(tools.map((tool) => tool.name).sort(), [
        "kompass_changes_load",
        "kompass_pr_load",
        "kompass_pr_load_review",
        "kompass_pr_sync",
        "kompass_ticket_load",
        "kompass_ticket_sync",
      ]);
      assert.ok(tools.every((tool) => tool.options?.codemode === false));
      assert.ok(tools.every((tool) => tool.output));
    });
  });

  test("returns structured output and model-visible content", async () => {
    await withTempHome(async () => {
      const directory = await createTempGitRepo();
      try {
        const tool = (await createOpenCodeTools(directory)).find((item) => item.name === "kompass_changes_load");
        assert.ok(tool);
        const result = await tool.execute({ base: "HEAD" } as never, {} as never);
        assert.deepEqual((result.output as { files: unknown[] }).files, []);
        assert.equal(JSON.parse(result.content as string).files.length, 0);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  test("honors aliases and disabled tools", async () => {
    await withTempHome(async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "kompass-v2-alias-"));
      try {
        await mkdir(path.join(directory, ".opencode"), { recursive: true });
        await writeFile(path.join(directory, ".opencode", "kompass.jsonc"), `{
          "tools": {
            "changes_load": { "enabled": false },
            "pr_load": { "enabled": false },
            "pr_load_review": { "enabled": false },
            "pr_sync": { "enabled": false },
            "ticket_load": { "enabled": false },
            "ticket_sync": { "name": "custom_ticket_sync" }
          }
        }`);
        assert.deepEqual((await createOpenCodeTools(directory)).map((tool) => tool.name), ["custom_ticket_sync"]);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  test("plugin setup registers v2 transforms", async () => {
    await withTempHome(async () => {
      const registered = { agents: [] as string[], commands: [] as string[], tools: [] as string[] };
      const context = {
        agent: {
          list: async () => ({ location: { directory: process.cwd() }, data: [] }),
          transform: async (transform: (draft: any) => void) => transform({
            update(name: string, update: (agent: any) => void) {
              registered.agents.push(name);
              update({ id: name, mode: "primary", permissions: [] });
            },
          }),
        },
        command: {
          transform: async (transform: (draft: any) => void) => transform({
            update(name: string, update: (command: any) => void) {
              registered.commands.push(name);
              update({ name, template: "" });
            },
          }),
        },
        tool: {
          transform: async (transform: (draft: any) => void) => transform({
            add(tool: any) { registered.tools.push(tool.name); },
          }),
        },
      };

      await OpenCodeCompassPlugin.setup(context as never);
      assert.ok(registered.agents.includes("worker"));
      assert.ok(registered.commands.includes("dev"));
      assert.ok(registered.tools.includes("kompass_changes_load"));
    });
  });
});
