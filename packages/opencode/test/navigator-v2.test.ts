import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Agent, Location, Model, type Plugin } from "@opencode/plugin/effect";
import { Session } from "@opencode/schema/session";
import { SessionMessage } from "@opencode/schema/session-message";
import { SessionInbox } from "@opencode/schema/session-inbox";
import { Tool } from "@opencode/schema/tool";
import { Deferred, Effect, Fiber, Schema, type Types } from "effect";
import { z } from "zod";
import { mergeWithDefaults } from "../../core/index.ts";
import { createNavigatorV2Tools, summarizeV2Messages } from "../navigator-v2.ts";

const model = Schema.decodeUnknownSync(Model.Ref)({ providerID: "test", id: "model", variant: "high" });
function session(id = "ses_caller", directory = "/repo", projectID = "project") {
  return Schema.decodeUnknownSync(Session.Info)({
    id, projectID, location: { directory }, agent: "worker", model,
    title: "Task", cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1, updated: 2 },
  });
}

function fixture() {
  const calls: Array<{ name: string; input: unknown }> = [];
  const sessions = new Map<string, Session.Info>([
    ["ses_caller", session()], ["ses_target", session("ses_target", "/snapshots/task")],
    ["ses_other", session("ses_other", "/snapshots/other")], ["ses_foreign", session("ses_foreign", "/foreign", "foreign")],
  ]);
  const config = mergeWithDefaults({});
  const location = Schema.decodeUnknownSync(Location.Info)({ directory: "/repo", project: { id: "project", directory: "/repo", canonical: "/repo" } });
  const methods: Types.Mutable<Pick<Plugin.Context["session"], "get" | "create" | "prompt" | "context" | "wait" | "interrupt" | "switchAgent" | "switchModel">> = {
    get: ({ sessionID }) => Effect.suspend(() => {
      const value = sessions.get(sessionID);
      return value ? Effect.succeed(value) : Effect.fail(new Error("Missing session"));
    }),
    create: (input) => Effect.sync(() => {
      calls.push({ name: "create", input });
      const created = { ...session(input!.id!, input!.location!.directory), agent: input?.agent, model: input?.model, title: input?.title };
      sessions.set(created.id, created);
      return created;
    }),
    prompt: (input) => Effect.sync(() => {
      calls.push({ name: "prompt", input });
      return Schema.decodeUnknownSync(SessionInbox.User)({ id: "msg_prompt", sessionID: input.sessionID, timeCreated: 3, type: "user", delivery: input.delivery, payload: { text: input.text } });
    }),
    context: () => Effect.succeed([]),
    wait: ({ sessionID }) => Effect.sync(() => { calls.push({ name: "wait", input: sessionID }); }),
    interrupt: (input) => Effect.sync(() => { calls.push({ name: "interrupt", input }); return { interrupted: true }; }),
    switchAgent: (input) => Effect.sync(() => { calls.push({ name: "switchAgent", input }); }),
    switchModel: (input) => Effect.sync(() => { calls.push({ name: "switchModel", input }); }),
  };
  const worktree: Types.Mutable<Pick<Plugin.Context["worktree"], "create" | "list">> = {
    create: (input) => Effect.sync(() => {
      calls.push({ name: "worktree", input });
      return Schema.decodeUnknownSync(Location.Ref)({ directory: "/snapshots/new" });
    }),
    list: () => Effect.succeed([
      { directory: location.directory },
      { directory: Schema.decodeUnknownSync(Location.Ref)({ directory: "/snapshots/task" }).directory, strategy: "rift" },
    ]),
  };
  const ctx = {
    location, session: methods, worktree,
    agent: { get: ({ agentID }: { agentID: Agent.ID }) => agentID === "missing"
      ? Effect.fail(new Error("Unknown agent")) : Effect.succeed({ location, data: Agent.Info.default(agentID) }) },
    catalog: { model: { list: () => Effect.succeed({ location, data: [{ id: model.id, providerID: model.providerID, enabled: true, variants: [{ id: "high" }] }] }) } },
  } as unknown as Plugin.Context;
  const invocation = {
    sessionID: Session.ID.make("ses_caller"), agent: Agent.ID.make("worker"),
    messageID: SessionMessage.ID.make("msg_caller"), id: Tool.CallID.make("call"),
    progress: (input) => Effect.sync(() => { calls.push({ name: "progress", input }); }),
  } satisfies Tool.Context;
  function execute(name: string, args: unknown) {
    const tool = createNavigatorV2Tools(ctx, config).find((entry) => entry.name === `kompass_${name}`)!;
    return tool.execute((tool.input as z.ZodType).parse(args), invocation).pipe(Effect.map((result) => JSON.parse(String(result.content))));
  }
  return { ctx, config, calls, sessions, methods, worktree, invocation, execute };
}

describe("native V2 Navigator", () => {
  test("creates a standalone worktree without creating or prompting a session", async () => {
    const f = fixture();
    const result = await Effect.runPromise(f.execute("worktree_create", { name: "task" }));
    assert.equal(result.status, "created");
    assert.equal(result.worktree.directory, "/snapshots/new");
    assert.deepEqual(f.calls.map((call) => call.name), ["worktree"]);
    await assert.rejects(Effect.runPromise(f.execute("worktree_create", { branch: "main" })), /requires strategy/);
  });

  test("creates an idle session then admits a separate prompt", async () => {
    const f = fixture();
    const result = await Effect.runPromise(f.execute("session_create", {}));
    assert.equal(result.status, "created");
    assert.equal(result.admitted, false);
    assert.equal(f.calls.some((call) => call.name === "prompt"), false);
    const sent = await Effect.runPromise(f.execute("session_send", { sessionID: result.session.sessionID, prompt: "Begin" }));
    assert.equal(sent.admitted, true);
  });

  test("native removal validates inventory and caller paths and forwards force", async () => {
    const f = fixture();
    const calls: unknown[] = [];
    Object.assign(f.worktree, { remove: (input: unknown) => Effect.sync(() => { calls.push(input); }) });
    for (const directory of ["/repo", "/", "/unknown"]) {
      await assert.rejects(Effect.runPromise(f.execute("worktree_remove", { directory })));
    }
    assert.deepEqual(calls, []);
    const result = await Effect.runPromise(f.execute("worktree_remove", { directory: "/snapshots/task" }));
    assert.equal(result.status, "removed");
    assert.deepEqual(calls[0], { location: f.sessions.get("ses_caller")!.location, directory: "/snapshots/task", force: false });
    await Effect.runPromise(f.execute("worktree_remove", { directory: "/snapshots/task", force: true }));
    assert.equal((calls[1] as { force: boolean }).force, true);
    f.sessions.set("ses_caller", session("ses_caller", "/snapshots/task/subdir"));
    await assert.rejects(Effect.runPromise(f.execute("worktree_remove", { directory: "/snapshots/task", force: true })), /calling session/);
    assert.equal(calls.length, 2);
  });
  test("registers supported tools with aliases, individual disables, and the feature toggle", () => {
    const f = fixture();
    assert.deepEqual(createNavigatorV2Tools(f.ctx, f.config).map((tool) => tool.name), [
      "kompass_worktree_list", "kompass_worktree_create", "kompass_worktree_remove", "kompass_session_create", "kompass_session_read", "kompass_session_send", "kompass_session_wait", "kompass_session_interrupt",
    ]);
    f.config.tools.session_create.name = "start_work";
    f.config.tools.session_read.enabled = false;
    const names = createNavigatorV2Tools(f.ctx, f.config).map((tool) => tool.name);
    assert.ok(names.includes("start_work"));
    assert.ok(!names.includes("kompass_session_read"));
    f.config.adapters.opencode.navigator.enabled = false;
    assert.deepEqual(createNavigatorV2Tools(f.ctx, f.config), []);
  });

  test("creates a default-strategy worktree, inherits context, and admits its prompt", async () => {
    const f = fixture();
    const created = await Effect.runPromise(f.execute("worktree_create", { name: "task" }));
    f.worktree.list = () => Effect.succeed([{ directory: created.worktree.directory, strategy: "rift" }]);
    const result = await Effect.runPromise(f.execute("session_create", {
      prompt: "Implement the change", title: "Implementation", directory: created.worktree.directory,
    }));
    assert.equal(result.status, "started");
    assert.equal(result.admitted, true);
    assert.equal(result.session.directory, "/snapshots/new");
    assert.equal(result.session.agent, "worker");
    assert.deepEqual(result.session.model, model);
    assert.equal(result.session.title, "Implementation");
    assert.deepEqual(f.calls.map((call) => call.name), ["worktree", "create", "progress", "prompt"]);
    assert.deepEqual(f.calls[0]!.input, { location: f.sessions.get("ses_caller")!.location, name: "task", strategy: undefined, branch: undefined });
    assert.deepEqual(f.calls.at(-1)!.input, { sessionID: result.session.sessionID, text: "Implement the change", delivery: "steer" });
    assert.equal(f.calls.some((call) => call.name === "wait"), false);
  });

  test("creates directly in an existing worktree or checkout", async () => {
    for (const directory of ["/repo", "/snapshots/task"]) {
      const f = fixture();
      const result = await Effect.runPromise(f.execute("session_create", { prompt: "Review", directory }));
      assert.equal(result.session.directory, directory);
      assert.equal(f.calls.some((call) => call.name === "worktree"), false);
    }
  });

  test("omitted directory uses the caller's location, including a worktree subdirectory", async () => {
    const f = fixture();
    f.sessions.set("ses_caller", session("ses_caller", "/snapshots/task/src"));
    const result = await Effect.runPromise(f.execute("session_create", { prompt: "Review" }));
    assert.equal(result.session.directory, "/snapshots/task/src");
    assert.equal(f.calls.some((call) => call.name === "worktree"), false);
    const checkout = await Effect.runPromise(f.execute("session_create", { directory: "/repo" }));
    assert.equal(checkout.session.directory, "/repo");
  });

  test("rejects the removed environment field rather than silently using the current directory", () => {
    const f = fixture();
    assert.throws(() => f.execute("session_create", { environment: { type: "new_worktree" } }));
    assert.deepEqual(f.calls, []);
  });

  test("rejects unmanaged directories, foreign callers, unknown agents and models before mutation", async () => {
    const inputs = [
      { directory: "/arbitrary" },
      { agent: "missing" },
      { model: { providerID: "unknown", id: "unknown" } },
      { model: { ...model, variant: "unknown" } },
    ];
    for (const input of inputs) {
      const f = fixture();
      await assert.rejects(Effect.runPromise(f.execute("session_create", { prompt: "Work", ...input })));
      assert.deepEqual(f.calls, []);
    }
    const f = fixture();
    f.sessions.set("ses_caller", session("ses_caller", "/foreign", "foreign"));
    await assert.rejects(Effect.runPromise(f.execute("session_create", { prompt: "Work" })), /another OpenCode project/);
    assert.deepEqual(f.calls, []);
  });

  test("passes an explicitly selected Git strategy and starting ref", async () => {
    const f = fixture();
    await Effect.runPromise(f.execute("worktree_create", { strategy: "git", branch: "main" }));
    assert.equal((f.calls[0]!.input as { strategy: string }).strategy, "git");
    assert.equal((f.calls[0]!.input as { branch: string }).branch, "main");
  });

  test("preserves resources and returns recovery details when prompt admission fails", async () => {
    const f = fixture();
    f.methods.prompt = () => Effect.fail(new Error("Provider unavailable"));
    const result = await Effect.runPromise(f.execute("session_create", { prompt: "Work", directory: "/snapshots/task" }));
    assert.equal(result.status, "partial_failure");
    assert.equal(result.phase, "prompt");
    assert.equal(result.admitted, false);
    assert.equal(result.session.directory, "/snapshots/task");
    assert.ok(f.sessions.has(result.session.sessionID));
    assert.equal(result.requestedSessionID, result.session.sessionID);
  });

  test("reports session creation failure without mutating worktrees", async () => {
    const f = fixture();
    f.methods.create = () => Effect.fail(new Error("Creation failed"));
    const result = await Effect.runPromise(f.execute("session_create", { prompt: "Work", directory: "/snapshots/task" }));
    assert.equal(result.phase, "session_create");
    assert.equal(result.session, undefined);
    assert.match(result.requestedSessionID, /^ses_/);
    assert.equal(result.directory, "/snapshots/task");
    assert.deepEqual(f.calls, []);
  });

  test("never prompts a session created in an unexpected location", async () => {
    const f = fixture();
    f.methods.create = () => Effect.succeed(session("ses_wrong", "/unexpected"));
    const result = await Effect.runPromise(f.execute("session_create", { prompt: "Work" }));
    assert.equal(result.status, "partial_failure");
    assert.equal(result.session.sessionID, "ses_wrong");
    assert.equal(f.calls.some((call) => call.name === "prompt"), false);
  });

  test("supports follow-up queueing and explicit agent/model changes", async () => {
    const f = fixture();
    const result = await Effect.runPromise(f.execute("session_send", { sessionID: "ses_target", prompt: "Next task", delivery: "queue", agent: "reviewer", model }));
    assert.equal(result.admitted, true);
    assert.deepEqual(f.calls.map((call) => call.name), ["switchAgent", "switchModel", "prompt"]);
    assert.equal((f.calls.at(-1)!.input as { delivery: string }).delivery, "queue");
  });

  test("rejects self-targeting and foreign sessions across lifecycle tools", async () => {
    for (const sessionID of ["ses_caller", "ses_foreign"]) {
      for (const [name, input] of [
        ["session_send", { sessionID, prompt: "Work" }],
        ["session_wait", { targets: [{ sessionID }] }],
        ["session_interrupt", { sessionID }],
      ] as const) {
        const f = fixture();
        await assert.rejects(Effect.runPromise(f.execute(name, input)));
        assert.deepEqual(f.calls, []);
      }
    }
    const f = fixture();
    await assert.rejects(Effect.runPromise(f.execute("session_read", { sessionID: "ses_foreign" })), /another OpenCode project/);
  });

  test("returns native interrupt results", async () => {
    const f = fixture();
    const result = await Effect.runPromise(f.execute("session_interrupt", { sessionID: "ses_target" }));
    assert.deepEqual(result, { sessionID: "ses_target", interrupted: true });
    assert.deepEqual(f.calls[0]!.input, { sessionID: "ses_target", continue: false });
  });

  test("native wait completes and releases losing waits", async () => {
    const f = fixture();
    const released: string[] = [];
    const started = Deferred.makeUnsafe<void>();
    f.methods.wait = ({ sessionID }) => sessionID === "ses_target"
      ? Deferred.await(started)
      : Effect.acquireUseRelease(Effect.void,
        () => Effect.gen(function* () { yield* Effect.yieldNow; yield* Deferred.succeed(started, undefined); yield* Effect.never; }),
        () => Effect.sync(() => { released.push(sessionID); }),
      );
    const result = await Effect.runPromise(f.execute("session_wait", { targets: [{ sessionID: "ses_target" }, { sessionID: "ses_other" }] }));
    assert.equal(result.status, "completed");
    assert.equal(result.completed.session.sessionID, "ses_target");
    assert.deepEqual(released, ["ses_other"]);
  });

  test("native wait timeouts are capped and release subscriptions without interrupting sessions", async () => {
    const f = fixture();
    f.config.adapters.opencode.navigator.maxWaitMs = 5;
    let released = false;
    f.methods.wait = () => Effect.never.pipe(Effect.ensuring(Effect.sync(() => { released = true; })));
    const result = await Effect.runPromise(f.execute("session_wait", { targets: [{ sessionID: "ses_target" }], timeoutMs: 100000 }));
    assert.equal(result.status, "timeout");
    assert.equal(released, true);
    assert.equal(f.calls.some((call) => call.name === "interrupt"), false);
  });

  test("cancelling the tool releases native waits", async () => {
    const f = fixture();
    let released = false;
    const started = Deferred.makeUnsafe<void>();
    f.methods.wait = () => Effect.gen(function* () { yield* Deferred.succeed(started, undefined); yield* Effect.never; }).pipe(
      Effect.ensuring(Effect.sync(() => { released = true; })),
    );
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(f.execute("session_wait", { targets: [{ sessionID: "ses_target" }] }));
      yield* Deferred.await(started);
      yield* Fiber.interrupt(fiber);
    }));
    assert.equal(released, true);
    assert.equal(f.calls.some((call) => call.name === "interrupt"), false);
  });

  test("session reads bound current context and optional tool output", () => {
    const f = fixture();
    const messages = Schema.decodeUnknownSync(Schema.Array(SessionMessage.Info))([
      { type: "user", id: "msg_old", time: { created: 1 }, text: "old" },
      { type: "assistant", id: "msg_latest", time: { created: 2 }, agent: "worker", model, content: [
        { type: "text", text: "x".repeat(100) },
        { type: "tool", id: "tool", name: "shell", time: { created: 2 }, state: { status: "completed", input: {}, content: [{ type: "text", text: "y".repeat(100) }] } },
      ] },
    ]);
    f.config.adapters.opencode.navigator.maxOutputCharsPerItem = 10;
    const result = summarizeV2Messages(messages, f.config.adapters.opencode.navigator, { turnLimit: 1, includeOutputs: true });
    assert.equal(result.messages.length, 1);
    assert.ok(JSON.stringify(result.messages).includes("yyyyyyyyyy"));
    assert.ok(!JSON.stringify(result.messages).includes("yyyyyyyyyyy"));
    assert.equal(result.truncation.truncated, true);
    const withoutOutputs = summarizeV2Messages(messages, f.config.adapters.opencode.navigator);
    assert.ok(!JSON.stringify(withoutOutputs.messages).includes("yyyy"));
    f.config.adapters.opencode.navigator.maxReadChars = 200;
    assert.ok(JSON.stringify(summarizeV2Messages(messages, f.config.adapters.opencode.navigator).messages).length <= 200);
  });
});
