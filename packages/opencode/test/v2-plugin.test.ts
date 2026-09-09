import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Agent, Location, type Plugin } from "@opencode/plugin/effect";
import type { CommandDefinition } from "@opencode/plugin/effect/command";
import type { Transform } from "@opencode/plugin/effect/registration";
import type { WorktreeDefinition } from "@opencode/plugin/effect/worktree";
import { Session } from "@opencode/schema/session";
import { Tool } from "@opencode/schema/tool";
import { Effect, Schema } from "effect";
import { z } from "zod";
import { OpenCodeCompassPluginV2, setupOpenCodeV2 } from "../index.ts";
import { loadResolvedCommands } from "../cache.ts";
import { createOpenCodeV2Tools } from "../v2.ts";
import { mergeWithDefaults } from "../../core/index.ts";

function fixture() {
  const agents = new Map<string, Agent.Info>();
  const commands = new Map<string, CommandDefinition>();
  const tools = new Map<string, Tool.Info>();
  const worktrees: WorktreeDefinition[] = [];
  const prompts: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];
  const switchedAgents: string[] = [];
  const disposed: string[] = [];
  function transform<Editor>(name: string, editor: Editor): Transform<Editor> {
    return (callback) => Effect.gen(function* () {
      callback(editor);
      let active = true;
      const dispose = Effect.sync(() => { if (active) disposed.push(name); active = false; });
      yield* Effect.addFinalizer(() => dispose);
      return { dispose };
    });
  }
  const ctx = {
    location: Schema.decodeUnknownSync(Location.Info)({ directory: process.cwd(), project: { id: "project", directory: process.cwd(), canonical: process.cwd() } }),
    agent: { transform: transform("agent", {
      update: (id: string, update: (agent: Agent.Info) => void) => {
        const agent = agents.get(id) ?? Agent.Info.default(Agent.ID.make(id));
        update(agent);
        agents.set(id, agent);
      },
    }) },
    command: { transform: transform("command", { add: (command: CommandDefinition) => commands.set(command.name, command) }) },
    tool: { transform: transform("tool", { add: (tool: Tool.Info) => tools.set(tool.name, tool) }) },
    worktree: { transform: transform("worktree", { add: (strategy: WorktreeDefinition) => worktrees.push(strategy) }) },
    session: {
      create: (input: Record<string, unknown>) => Effect.sync(() => {
        createdSessions.push(input);
        return { id: Session.ID.make("ses_child") };
      }),
      switchAgent: ({ agent }: { agent: string }) => Effect.sync(() => { switchedAgents.push(agent); }),
      prompt: (input: Record<string, unknown>) => Effect.sync(() => { prompts.push(input); }),
    },
  };
  return { ctx, context: ctx as unknown as Plugin.Context, agents, commands, tools, worktrees, prompts, createdSessions, switchedAgents, disposed };
}

describe("OpenCode v2 plugin", () => {
  test("exports the native Effect setup directly", () => {
    assert.equal(OpenCodeCompassPluginV2.id, "kompass");
    assert.equal(OpenCodeCompassPluginV2.effect, setupOpenCodeV2);
  });

  test("registers agents, commands, all tools, and Rift on the host scope", async () => {
    const f = fixture();
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      yield* setupOpenCodeV2(f.context);
      assert.ok(f.agents.has("worker"));
      assert.ok(f.commands.has("dev"));
      assert.deepEqual(f.worktrees.map((strategy) => strategy.id), ["rift"]);
      assert.equal(Effect.isEffect(f.worktrees[0]!.list(process.cwd())), true);
      assert.deepEqual([...f.tools.keys()].sort(), [
        "kompass_changes_load", "kompass_pr_load", "kompass_pr_load_review", "kompass_pr_sync",
        "kompass_session_create", "kompass_session_interrupt", "kompass_session_read", "kompass_session_send", "kompass_session_wait",
        "kompass_ticket_load", "kompass_ticket_sync", "kompass_worktree_create", "kompass_worktree_list", "kompass_worktree_remove",
      ]);
      assert.equal(typeof (f.tools.get("kompass_changes_load")!.input as z.ZodType)["~standard"].validate, "function");
      assert.deepEqual(f.disposed, []);
    })));
    assert.deepEqual(f.disposed.sort(), ["agent", "command", "tool", "worktree"]);
  });

  test("native commands always run inline and preserve arguments, attachments, and delivery", async () => {
    const f = fixture();
    const resolved = await loadResolvedCommands(process.cwd());
    const text = "Keep literal $& $$ $1 $ARGUMENTS and !`printf should-not-run`";
    const files = [{ uri: "file:///project/example.ts" }];
    const sessionID = Session.ID.make("ses_current");
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      yield* setupOpenCodeV2(f.context);
      assert.equal(f.commands.size, Object.keys(resolved).length);
      yield* f.commands.get("dev")!.execute({ sessionID, prompt: { text, files }, delivery: "queue" });
      assert.equal(f.prompts[0]?.text, resolved.dev!.template.replaceAll("$ARGUMENTS", () => text));
      assert.equal(f.prompts[0]?.files, files);
      assert.equal(f.prompts[0]?.delivery, "queue");
      assert.equal(f.prompts[0]?.sessionID, sessionID);
      assert.equal(f.createdSessions.length, 0);
      assert.equal(f.switchedAgents.at(-1), "worker");
      yield* f.commands.get("learn")!.execute({ sessionID, prompt: { text: "remember this" }, delivery: "steer" });
      assert.equal(f.switchedAgents.at(-1), "worker");
      assert.equal(f.prompts[1]?.sessionID, sessionID);
      assert.equal(f.prompts[1]?.text, resolved.learn!.template.replaceAll("$ARGUMENTS", "remember this"));
    })));
  });

  test("failed setup releases prior native registrations", async () => {
    const f = fixture();
    f.ctx.tool.transform = () => Effect.die(new Error("Registration failed"));
    await assert.rejects(Effect.runPromise(Effect.scoped(setupOpenCodeV2(f.context))), /Registration failed/);
    assert.deepEqual(f.disposed.sort(), ["agent", "command"]);
    assert.deepEqual(f.worktrees, []);
  });

  test("shared core failures enter the native Tool.Error channel", async () => {
    const tools = createOpenCodeV2Tools(process.cwd(), mergeWithDefaults({}));
    const tool = tools.find((entry) => entry.name === "kompass_ticket_load")!;
    const invocation = { sessionID: Session.ID.make("ses_current") } as Tool.Context;
    const error = await Effect.runPromise(Effect.flip(tool.execute({ source: process.cwd() }, invocation)));
    assert.ok(error instanceof Tool.Error);
    assert.ok(error.message.length > 0);
  });
});
