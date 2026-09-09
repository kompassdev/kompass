import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  OpenCodeCompassPluginV2,
  setupOpenCodeV2,
} from "../index.ts";
import { loadResolvedCommands } from "../cache.ts";
import type { WorktreeDefinition } from "@opencode/plugin/promise/worktree";

describe("OpenCode v2 plugin", () => {
  test("exports the v2 plugin definition", () => {
    assert.equal(OpenCodeCompassPluginV2.id, "kompass");
    assert.equal(OpenCodeCompassPluginV2.setup, setupOpenCodeV2);
  });

  test("registers location-scoped agents, commands, and tools", async () => {
    const agents: string[] = [];
    type Command = { name: string; execute(input: { sessionID: string; prompt: { text: string; files?: unknown[] }; delivery: string }): Promise<void> };
    const commands = new Map<string, Command>();
    const prompts: Array<Record<string, unknown>> = [];
    const switchedAgents: string[] = [];
    const createdSessions: Array<Record<string, unknown>> = [];
    const tools = new Map<string, { input: unknown }>();
    const disposed: string[] = [];
    const worktrees: WorktreeDefinition[] = [];
    const availableAgents = new Map<string, Record<string, unknown>>();
    const context = {
      location: { directory: process.cwd() },
      worktree: {
        transform: async (transform: (draft: { add(strategy: WorktreeDefinition): void }) => void) => {
          transform({ add: (strategy) => { worktrees.push(strategy); } });
          return { dispose: async () => { disposed.push("worktree"); } };
        },
      },
      agent: {
        transform: async (transform: (draft: unknown) => void) => {
          transform({
            update(name: string, update: (agent: Record<string, unknown>) => void) {
              agents.push(name);
              const agent = availableAgents.get(name) ?? { id: name, permissions: [] };
              update(agent);
              availableAgents.set(name, agent);
            },
          });
          return { dispose: async () => { disposed.push("agent"); } };
        },
        reload: async () => {},
      },
      command: {
        transform: async (transform: (draft: unknown) => void) => {
          transform({
            add(command: Command) {
              commands.set(command.name, command);
            },
          });
          return { dispose: async () => { disposed.push("command"); } };
        },
        reload: async () => {},
      },
      tool: {
        transform: async (transform: (draft: unknown) => void) => {
          transform({
            add(tool: { name: string; input: unknown }) {
              tools.set(tool.name, tool);
            },
          });
          return { dispose: async () => { disposed.push("tool"); } };
        },
        reload: async () => {},
      },
      session: {
        create: async (input: Record<string, unknown>) => {
          createdSessions.push(input);
          return { id: "child-1" };
        },
        switchAgent: async ({ agent }: { agent: string }) => {
          switchedAgents.push(agent);
        },
        prompt: async (input: Record<string, unknown>) => {
          prompts.push(input);
        },
      },
    };

    const cleanup = await setupOpenCodeV2(context as never);
    assert.ok(agents.includes("worker"));
    assert.ok(commands.has("dev"));
    assert.deepEqual(worktrees.map((strategy) => strategy.id), ["rift"]);
    assert.deepEqual([...tools.keys()].sort(), [
      "kompass_changes_load",
      "kompass_pr_load",
      "kompass_pr_load_review",
      "kompass_pr_sync",
      "kompass_ticket_load",
      "kompass_ticket_sync",
    ]);
    assert.equal(typeof (tools.get("kompass_changes_load")?.input as any)?.["~standard"]?.validate, "function");

    const resolved = await loadResolvedCommands(process.cwd());
    assert.equal(commands.size, Object.keys(resolved).length);
    const text = "Keep literal $& $$ $1 $ARGUMENTS and !`printf should-not-run`";
    const files = [{ uri: "file:///project/example.ts" }];
    await commands.get("dev")!.execute({
      sessionID: "session-1",
      prompt: { text, files },
      delivery: "queue",
    });
    assert.equal(prompts[0]?.text, resolved.dev!.template.replaceAll("$ARGUMENTS", () => text));
    assert.equal(prompts[0]?.files, files);
    assert.equal(prompts[0]?.delivery, "queue");
    assert.equal(prompts[0]?.sessionID, process.env.CI ? "session-1" : "child-1");
    assert.equal(createdSessions.length, process.env.CI ? 0 : 1);
    if (!process.env.CI) assert.equal(createdSessions[0]?.agent, "worker");

    await commands.get("learn")!.execute({
      sessionID: "session-1",
      prompt: { text: "remember this" },
      delivery: "steer",
    });
    assert.equal(switchedAgents.at(-1), "worker");
    assert.equal(prompts[1]?.sessionID, "session-1");
    assert.equal(prompts[1]?.text, resolved.learn!.template.replaceAll("$ARGUMENTS", "remember this"));

    await cleanup();
    assert.deepEqual(disposed.sort(), ["agent", "command", "tool", "worktree"]);
  });
});
