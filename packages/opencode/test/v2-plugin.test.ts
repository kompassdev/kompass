import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  OpenCodeCompassPluginV2,
  setupOpenCodeV2,
} from "../index.ts";
import { expandCommand } from "../v2.ts";

describe("OpenCode v2 plugin", () => {
  test("exports the v2 plugin definition", () => {
    assert.equal(OpenCodeCompassPluginV2.id, "kompass");
    assert.equal(OpenCodeCompassPluginV2.setup, setupOpenCodeV2);
  });

  test("inlines output from failing shell substitutions", async () => {
    const prompt = await expandCommand(
      "Result: !`printf stdout; printf stderr >&2; exit 1`",
      "",
      process.cwd(),
    );

    assert.equal(prompt, "Result: stdoutstderr");
  });

  test("registers location-scoped agents, commands, and tools", async () => {
    const agents: string[] = [];
    const commands = new Map<string, { execute(input: unknown): Promise<void> }>();
    const tools = new Map<string, { input: unknown }>();
    const prompts: Array<Record<string, unknown>> = [];
    const switchedAgents: string[] = [];
    const createdSessions: Array<Record<string, unknown>> = [];
    const availableAgents = new Map([
      ["worker", { id: "worker", permissions: [] as unknown[] }],
      ["planner", { id: "planner", permissions: [] as unknown[] }],
      ["reviewer", { id: "reviewer", permissions: [] as unknown[] }],
    ]);
    const context = {
      location: { directory: process.cwd() },
      agent: {
        transform: async (transform: (draft: unknown) => void) => transform({
          get(name: string) {
            return availableAgents.get(name);
          },
          update(name: string, update: (agent: Record<string, unknown>) => void) {
            agents.push(name);
            update(availableAgents.get(name) as Record<string, unknown>);
          },
        }),
        reload: async () => {},
      },
      command: {
        transform: async (transform: (draft: unknown) => void) => transform({
          add(command: { name: string; execute(input: unknown): Promise<void> }) {
            commands.set(command.name, command);
          },
        }),
        reload: async () => {},
      },
      tool: {
        transform: async (transform: (draft: unknown) => void) => transform({
          add(tool: { name: string; input: unknown }) {
            tools.set(tool.name, tool);
          },
        }),
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

    await setupOpenCodeV2(context as never);
    assert.ok(agents.includes("worker"));
    assert.ok(commands.has("dev"));
    assert.deepEqual([...tools.keys()].sort(), [
      "kompass_changes_load",
      "kompass_pr_load",
      "kompass_pr_load_review",
      "kompass_pr_sync",
      "kompass_ticket_load",
      "kompass_ticket_sync",
    ]);
    assert.equal(typeof (tools.get("kompass_changes_load")?.input as any)?.["~standard"]?.validate, "function");

    await commands.get("dev")?.execute({
      sessionID: "session-1",
      prompt: { text: "fix auth" },
      delivery: "steer",
    });
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSessions[0]?.agent, "worker");
    assert.equal(switchedAgents.length, 0);
    assert.equal(prompts[0]?.sessionID, "child-1");
    assert.match(String(prompts[0]?.text), /fix auth/);

    await commands.get("learn")?.execute({
      sessionID: "session-1",
      prompt: { text: "remember this" },
      delivery: "steer",
    });
    assert.deepEqual(switchedAgents, ["worker"]);
    assert.equal(prompts[1]?.sessionID, "session-1");
  });
});
