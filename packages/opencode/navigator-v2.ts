import { Agent, Location, Model, Worktree, type Plugin } from "@opencode/plugin/effect";
import { Session } from "@opencode/schema/session";
import { SessionMessage } from "@opencode/schema/session-message";
import { Tool } from "@opencode/schema/tool";
import { DateTime, Effect, Option, Schema } from "effect";
import path from "node:path";
import { z } from "zod";
import { V2_NAVIGATOR_TOOL_NAMES, type MergedKompassConfig, type NavigatorConfig } from "../core/index.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";

const guidance = "Use only when the user explicitly asks to create or manage native OpenCode sessions, worktrees, or a multi-session workflow. Use OpenCode's subagent tool for ordinary delegation.";
const sessionIDSchema = z.string().startsWith("ses_");
const modelSchema = z.object({
  providerID: z.string().min(1),
  id: z.string().min(1),
  variant: z.string().min(1).optional(),
});
const deliverySchema = z.enum(["steer", "queue"]).default("steer");
const worktreeCreateSchema = z.object({
  name: z.string().min(1).optional(),
  strategy: z.enum(["rift", "git"]).optional(),
  branch: z.string().min(1).optional(),
});

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function summary(session: Session.Info) {
  return {
    sessionID: session.id,
    projectID: session.projectID,
    directory: session.location.directory,
    workspaceID: session.location.workspaceID,
    title: session.title,
    agent: session.agent,
    model: session.model,
    outcome: session.outcome,
    createdAt: DateTime.toEpochMillis(session.time.created),
    updatedAt: DateTime.toEpochMillis(session.time.updated),
  };
}

export function summarizeV2Messages(
  messages: readonly SessionMessage.Info[],
  config: NavigatorConfig,
  options: { turnLimit?: number; includeOutputs?: boolean; maxOutputCharsPerItem?: number } = {},
) {
  const perItem = Math.min(options.maxOutputCharsPerItem ?? config.maxOutputCharsPerItem, config.maxOutputCharsPerItem, config.maxReadChars);
  let truncated = false;
  const text = (value: string) => {
    if (value.length > perItem) truncated = true;
    return value.slice(0, perItem);
  };
  const selected = messages.slice(-(options.turnLimit ?? 20)).map((entry) => ({
    id: entry.id,
    type: entry.type,
    createdAt: DateTime.toEpochMillis(entry.time.created),
    ...("text" in entry && typeof entry.text === "string" ? { text: text(entry.text) } : {}),
    ...(entry.type === "assistant" ? {
      error: entry.error?.message,
      items: entry.content.map((item) => {
        if (item.type !== "tool") return { type: item.type, text: text(item.text) };
        return {
          type: "tool",
          name: item.name,
          status: item.state.status,
          ...(item.state.status === "error" ? { error: text(item.state.error.message) } : {}),
          ...(options.includeOutputs && "content" in item.state ? {
            output: text((item.state.content ?? []).flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")),
          } : {}),
        };
      }),
    } : {}),
  }));
  while (selected.length && JSON.stringify(selected).length > config.maxReadChars) {
    selected.shift();
    truncated = true;
  }
  return { messages: selected, truncation: { truncated: truncated || selected.length < messages.length, totalMessages: messages.length, returnedMessages: selected.length } };
}

export function createNavigatorV2Tools(ctx: Plugin.Context, config: MergedKompassConfig): Tool.Info[] {
  if (!config.adapters.opencode.navigator.enabled) return [];
  const limits = config.adapters.opencode.navigator;
  const createWorktree = Effect.fn("navigator.createWorktree")(function* (location: Location.Ref, input: z.infer<typeof worktreeCreateSchema>) {
    if (location.workspaceID) return yield* Effect.fail(new Error("Worktree creation requires a local session"));
    if (input.branch && input.strategy !== "git") {
      return yield* Effect.fail(new Error("A starting branch/ref requires strategy: git; Rift snapshots the source checkout"));
    }
    return yield* ctx.worktree.create({ location, name: input.name, strategy: input.strategy ? Worktree.StrategyID.make(input.strategy) : undefined, branch: input.branch });
  });
  const owned = Effect.fn("navigator.owned")(function* (sessionID: string) {
    const session = yield* ctx.session.get({ sessionID: Session.ID.make(sessionID) });
    if (session.projectID !== ctx.location.project.id) {
      return yield* Effect.fail(new Error(`Session ${sessionID} belongs to another OpenCode project`));
    }
    return session;
  });
  const target = Effect.fn("navigator.target")(function* (sessionID: string, callerID: string) {
    if (sessionID === callerID) return yield* Effect.fail(new Error("Navigator cannot send to, wait for, or interrupt its calling session"));
    return yield* owned(sessionID);
  });
  const validateSelection = Effect.fn("navigator.validateSelection")(function* (location: Location.Ref, agent?: string, model?: z.infer<typeof modelSchema>) {
    if (agent) {
      yield* ctx.agent.get({ agentID: Agent.ID.make(agent), location });
    }
    if (model) {
      const models = yield* ctx.catalog.model.list({ location });
      const selected = models.data.find((item) => item.providerID === model.providerID && item.id === model.id && item.enabled);
      if (!selected) return yield* Effect.fail(new Error(`Unknown or disabled OpenCode model ${model.providerID}/${model.id}`));
      if (model.variant && !selected.variants.some((variant) => variant.id === model.variant)) {
        return yield* Effect.fail(new Error(`Unknown model variant ${model.variant}`));
      }
    }
  });
  const read = Effect.fn("navigator.read")(function* (sessionID: string, options: Parameters<typeof summarizeV2Messages>[2] = {}) {
    const session = yield* owned(sessionID);
    const messages = yield* ctx.session.context({ sessionID: session.id });
    return { session: summary(session), ...summarizeV2Messages(messages, limits, options) };
  });
  function tool<S extends z.ZodType>(
    name: (typeof V2_NAVIGATOR_TOOL_NAMES)[number],
    description: string,
    input: S,
    execute: (args: z.output<S>, invocation: Tool.Context) => Effect.Effect<unknown, unknown>,
  ): Tool.Info<S> {
    return {
      name: getConfiguredOpenCodeToolName(name, config.tools[name].name),
      description: `${guidance} ${description}`,
      input,
      options: { codemode: false },
      execute: (args, invocation) => execute(args as z.output<S>, invocation).pipe(
        Effect.map((result) => ({ content: JSON.stringify(result) })),
        Effect.mapError((error) => new Tool.Error({ message: message(error) })),
      ),
    };
  }
  const definitions = {
    worktree_create: tool("worktree_create", "Create a managed worktree without creating a session. Uses the caller's location as source and the registered default strategy, normally Rift. Pass the returned directory to session_create to start work there. A starting branch requires strategy: git.", worktreeCreateSchema,
      Effect.fn("navigator.worktree_create")(function* (args, invocation) {
        const caller = yield* owned(invocation.sessionID);
        const worktree = yield* createWorktree(caller.location, args);
        return { status: "created", worktree };
      })),
    worktree_remove: tool("worktree_remove", "Remove a managed worktree through OpenCode. Does not delete sessions or interrupt them. V2 cannot discover active sessions: finish or interrupt known sessions using this directory first. force defaults to false and permits discarding uncommitted files when true. Rift snapshots with children cannot be removed, even with force.", z.object({ directory: z.string().min(1), force: z.boolean().default(false) }),
      Effect.fn("navigator.worktree_remove")(function* (args, invocation) {
        const caller = yield* owned(invocation.sessionID);
        const directory = path.resolve(args.directory);
        const within = (root: string) => {
          const relative = path.relative(directory, root);
          return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
        };
        if (within(ctx.location.project.canonical) || within(caller.location.directory) || within(ctx.location.directory)) {
          return yield* Effect.fail(new Error("Cannot remove the checkout or a worktree containing the calling session or plugin"));
        }
        const inventory = yield* ctx.worktree.list({ location: caller.location });
        const selected = inventory.find((entry) => entry.strategy !== undefined && path.resolve(entry.directory) === directory);
        if (!selected) return yield* Effect.fail(new Error("The requested directory is not a managed OpenCode worktree for this project"));
        yield* ctx.worktree.remove({ location: caller.location, directory: selected.directory, force: args.force });
        return { status: "removed", directory: selected.directory };
      })),
    worktree_list: tool("worktree_list", "List this project's checkout and native managed worktrees, including Rift snapshots.", z.object({}),
      Effect.fn("navigator.worktree_list")(function* (_args, invocation) {
        const caller = yield* owned(invocation.sessionID);
        const inventory = yield* ctx.worktree.list({ location: caller.location });
        return { checkout: { directory: ctx.location.project.canonical }, worktrees: inventory.filter((entry) => entry.strategy !== undefined) };
      })),
    session_create: tool("session_create", "Create a native session. directory defaults to the calling session's current directory; supply a checkout or managed worktree directory to work elsewhere. To use a new worktree, call worktree_create first and pass its returned directory. Optional prompt starts execution immediately; omit it to create an idle session and use session_send later.", z.object({
      prompt: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
      directory: z.string().min(1).optional(),
      agent: z.string().min(1).optional(),
      model: modelSchema.optional(),
    }).strict(), Effect.fn("navigator.session_create")(function* (args, invocation) {
      const caller = yield* owned(invocation.sessionID);
      const agent = args.agent ?? caller.agent;
      const model = args.model ?? caller.model;
      let location = caller.location;
      const directory = args.directory ? path.resolve(caller.location.directory, args.directory) : caller.location.directory;
      if (directory !== caller.location.directory) {
        if (caller.location.workspaceID) return yield* Effect.fail(new Error("Selecting another directory requires a local session"));
        if (directory === ctx.location.project.canonical) {
          location = Location.Ref.make({ directory: ctx.location.project.canonical });
        } else {
          const inventory = yield* ctx.worktree.list({ location: caller.location });
          const selected = inventory.find((entry) => entry.strategy !== undefined && path.resolve(entry.directory) === directory);
          if (!selected) return yield* Effect.fail(new Error("The requested directory is not a managed OpenCode worktree for this project"));
          location = Location.Ref.make({ directory: selected.directory });
        }
      }
      yield* validateSelection(location, agent, model);
      let session: Session.Info | undefined;
      let requestedSessionID: Session.ID | undefined;
      let phase = "session_create";
      return yield* Effect.gen(function* () {
        requestedSessionID = Session.ID.create();
        session = yield* ctx.session.create({ id: requestedSessionID, location, title: args.title, agent: agent ? Agent.ID.make(agent) : undefined, model: model ? Schema.decodeUnknownSync(Model.Ref)(model) : undefined });
        yield* invocation.progress({ sessionID: session.id, directory: session.location.directory, phase: "session_created" });
        if (session.projectID !== ctx.location.project.id || session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID) {
          return yield* Effect.fail(new Error("OpenCode created the session in an unexpected project or location"));
        }
        phase = "prompt";
        if (!args.prompt) return { status: "created", admitted: false, session: summary(session) };
        const admitted = yield* ctx.session.prompt({ sessionID: session.id, text: args.prompt, delivery: "steer" });
        return { status: "started", admitted: true, messageID: admitted.id, session: summary(session) };
      }).pipe(Effect.catch((error) => Effect.succeed({
        status: "partial_failure", admitted: false, phase, error: message(error),
        requestedSessionID, session: session ? summary(session) : undefined,
        directory: location.directory,
        recovery: "The session is preserved. Read the returned session ID before retrying a prompt.",
      })));
    })),
    session_read: tool("session_read", "Read a bounded snapshot of a current-project session's current model context, including recent messages. This is not paginated full history.", z.object({
      sessionID: sessionIDSchema,
      turnLimit: z.number().int().positive().max(100).optional(),
      includeOutputs: z.boolean().optional(),
      maxOutputCharsPerItem: z.number().int().positive().optional(),
    }), (args) => read(args.sessionID, args)),
    session_send: tool("session_send", "Admit another prompt to a current-project session, with steer or queue delivery and optional agent/model changes.", z.object({
      sessionID: sessionIDSchema, prompt: z.string().min(1), delivery: deliverySchema,
      agent: z.string().min(1).optional(), model: modelSchema.optional(),
    }), Effect.fn("navigator.session_send")(function* (args, invocation) {
      const session = yield* target(args.sessionID, invocation.sessionID);
      yield* validateSelection(session.location, args.agent, args.model);
      if (args.agent) yield* ctx.session.switchAgent({ sessionID: session.id, agent: Agent.ID.make(args.agent) });
      if (args.model) yield* ctx.session.switchModel({ sessionID: session.id, model: Schema.decodeUnknownSync(Model.Ref)(args.model) });
      const admitted = yield* ctx.session.prompt({ sessionID: session.id, text: args.prompt, delivery: args.delivery });
      return { sessionID: session.id, admitted: true, messageID: admitted.id, delivery: args.delivery };
    })),
    session_wait: tool("session_wait", "Wait for the first target session to become idle using OpenCode's native wait. Timeout or cancellation ends only the wait, not the target sessions. Completion includes the session outcome and bounded context.", z.object({
      targets: z.array(z.object({ sessionID: sessionIDSchema })).min(1).max(8),
      timeoutMs: z.number().int().positive().optional(),
    }), Effect.fn("navigator.session_wait")(function* (args, invocation) {
      const ids = args.targets.map((item) => item.sessionID);
      if (new Set(ids).size !== ids.length) return yield* Effect.fail(new Error("Navigator wait targets must be unique"));
      const sessions = yield* Effect.all(ids.map((id) => target(id, invocation.sessionID)), { concurrency: "unbounded" });
      const completed = yield* Effect.raceAllFirst(sessions.map((session) => ctx.session.wait({ sessionID: session.id }).pipe(Effect.as(session.id)))).pipe(
        Effect.timeoutOption(Math.min(args.timeoutMs ?? limits.maxWaitMs, limits.maxWaitMs)),
      );
      if (Option.isNone(completed)) return { status: "timeout", targets: args.targets };
      return { status: "completed", completed: yield* read(completed.value) };
    })),
    session_interrupt: tool("session_interrupt", "Interrupt a current-project session through OpenCode's native lifecycle API.", z.object({ sessionID: sessionIDSchema }),
      Effect.fn("navigator.session_interrupt")(function* (args, invocation) {
        const session = yield* target(args.sessionID, invocation.sessionID);
        const result = yield* ctx.session.interrupt({ sessionID: session.id, continue: false });
        return { sessionID: session.id, ...result };
      })),
  };
  return V2_NAVIGATOR_TOOL_NAMES.filter((name) => config.tools[name].enabled !== false).map((name) => definitions[name]);
}
