import type { ToolContext, ToolDefinition } from "@opencode-ai/plugin/tool";
import { tool } from "@opencode-ai/plugin/tool";
import type {
  Message as LegacyMessage,
  OpencodeClient as LegacyOpencodeClient,
  Part as LegacyPart,
} from "@opencode-ai/sdk/client";
import type {
  OpencodeClient,
  SessionMessage,
  SessionV2Info,
  Worktree,
} from "@opencode-ai/sdk/v2/client";
import path from "node:path";

import type { NavigatorConfig } from "../core/index.ts";

export type NavigatorClient = Pick<OpencodeClient, "worktree" | "v2" | "global">;
export type NavigatorLegacyClient = Pick<LegacyOpencodeClient, "session">;

type NavigatorProtocol = "v1" | "v2";
type LegacySessionMessage = { info: LegacyMessage; parts: LegacyPart[] };

export interface SessionSummary {
  sessionID: string;
  projectID: string;
  directory: string;
  title: string;
  agent?: string;
  model?: { providerID: string; modelID: string };
  createdAt: number;
  updatedAt: number;
  state: "active" | "idle";
}

export interface MessageSummary {
  id: string;
  type: string;
  createdAt?: number;
  completedAt?: number;
  agent?: string;
  model?: { providerID: string; modelID: string };
  items: Array<{
    type: string;
    text?: string;
    name?: string;
    status?: string;
    output?: string;
    truncated?: boolean;
    originalChars?: number;
    returnedChars?: number;
  }>;
}

type NavigatorToolName =
  | "worktree_list"
  | "session_create"
  | "session_list"
  | "session_read"
  | "session_send"
  | "session_wait"
  | "session_interrupt"
  | "worktree_remove";

type NavigatorContext = {
  checkout: string;
  projectID: string;
  config: NavigatorConfig;
  protocol: NavigatorProtocol;
  legacyClient: (directory: string) => NavigatorLegacyClient;
};

type NativeWorktree = { directory: string; name: string; branch?: string };

function failResponse(error: unknown, operation: string): never {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : JSON.stringify(error);
  throw new Error(`${operation} failed${message ? `: ${message}` : ""}`);
}

function responseData<T>(response: { data?: T; error?: unknown }, operation: string): T {
  if (response.error !== undefined) failResponse(response.error, operation);
  if (response.data === undefined) throw new Error(`${operation} returned no data`);
  return response.data;
}

function envelopeData<T>(response: { data?: { data: T }; error?: unknown }, operation: string): T {
  return responseData(response, operation).data;
}

function normalizeDirectory(directory: string) {
  return path.resolve(directory);
}

function sameDirectory(left: string, right: string) {
  return normalizeDirectory(left) === normalizeDirectory(right);
}

function normalizeWorktree(value: string | Worktree): NativeWorktree {
  if (typeof value === "string") {
    return { directory: value, name: path.basename(value) };
  }
  return { directory: value.directory, name: value.name, ...(value.branch ? { branch: value.branch } : {}) };
}

async function listManagedWorktrees(client: NavigatorClient, checkout: string) {
  const values = responseData(
    await client.worktree.list({ directory: checkout }),
    "OpenCode worktree list",
  ) as Array<string | Worktree>;
  return values.map(normalizeWorktree).filter((item) => !sameDirectory(item.directory, checkout));
}

async function activeSessionIDs(client: NavigatorClient, navigator: NavigatorContext) {
  if (navigator.protocol === "v1") {
    const worktrees = await listManagedWorktrees(client, navigator.checkout);
    const directories = [navigator.checkout, ...worktrees.map((item) => item.directory)];
    const statuses = await Promise.all(directories.map(async (directory) => responseData(
      await navigator.legacyClient(directory).session.status(),
      `OpenCode session status for ${directory}`,
    ) as Record<string, { type: string }>));
    return new Set(statuses.flatMap((items) => Object.entries(items)
      .filter(([, status]) => status.type !== "idle")
      .map(([sessionID]) => sessionID)));
  }
  const active = envelopeData(
    await client.v2.session.active(),
    "OpenCode active session list",
  );
  return new Set(Object.keys(active));
}

function projectLegacyMessages(messages: LegacySessionMessage[]): SessionMessage[] {
  return messages.map(({ info, parts }) => {
    if (info.role === "user") {
      return {
        id: info.id,
        type: "user",
        time: { created: info.time.created },
        text: parts.filter((part) => part.type === "text").map((part) => part.text).join("\n"),
      };
    }

    const content: Extract<SessionMessage, { type: "assistant" }>["content"] = [];
    for (const part of parts) {
      if (part.type === "text" || part.type === "reasoning") {
        content.push({ id: part.id, type: part.type, text: part.text });
        continue;
      }
      if (part.type !== "tool") continue;
      const state = part.state.status === "pending"
        ? { status: "pending", input: JSON.stringify(part.state.input) }
        : part.state.status === "running"
          ? { status: "running", input: part.state.input, structured: {}, content: [] }
          : part.state.status === "completed"
            ? { status: "completed", input: part.state.input, structured: {}, content: [], result: part.state.output }
            : {
                status: "error",
                input: part.state.input,
                structured: {},
                content: [],
                error: { name: "UnknownError", data: { message: part.state.error } },
              };
      content.push({
        id: part.id,
        type: "tool",
        name: part.tool,
        state,
        time: {
          created: "time" in part.state ? part.state.time.start : info.time.created,
          ...("time" in part.state && "end" in part.state.time ? { completed: part.state.time.end } : {}),
        },
      } as Extract<SessionMessage, { type: "assistant" }>["content"][number]);
    }

    return {
      id: info.id,
      type: "assistant",
      time: info.time,
      agent: info.mode,
      model: { providerID: info.providerID, id: info.modelID },
      content,
    } as SessionMessage;
  });
}

async function getOwnedSession(
  client: NavigatorClient,
  projectID: string,
  sessionID: string,
): Promise<SessionV2Info> {
  const session = await getSession(client, sessionID);
  if (session.projectID !== projectID) {
    throw new Error(`Session ${sessionID} does not belong to the current OpenCode project`);
  }
  return session;
}

async function getSession(client: NavigatorClient, sessionID: string): Promise<SessionV2Info> {
  return envelopeData(
    await client.v2.session.get({ sessionID }),
    `OpenCode session ${sessionID}`,
  );
}

function summarizeSession(session: SessionV2Info, active: Set<string>): SessionSummary {
  return {
    sessionID: session.id,
    projectID: session.projectID,
    directory: session.location.directory,
    title: session.title,
    ...(session.agent ? { agent: session.agent } : {}),
    ...(session.model
      ? { model: { providerID: session.model.providerID, modelID: session.model.id } }
      : {}),
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    state: active.has(session.id) ? "active" : "idle",
  };
}

function assertNotCallingSession(sessionID: string, context: ToolContext, operation: string) {
  if (sessionID === context.sessionID) {
    throw new Error(`Navigator cannot target the calling session for ${operation}`);
  }
}

function toolStatus(message: Extract<SessionMessage, { type: "assistant" }>["content"][number]) {
  return message.type === "tool" ? message.state.status : undefined;
}

function summarizeMessages(
  messages: SessionMessage[],
  options: { includeOutputs: boolean; maxItemChars: number; maxTotalChars: number },
) {
  let remaining = options.maxTotalChars;
  let originalChars = 0;
  let returnedChars = 0;
  let omittedItems = 0;

  function bounded(value: string | undefined) {
    if (value === undefined) return { omitted: true } as const;
    originalChars += value.length;
    const limit = Math.min(options.maxItemChars, remaining);
    if (limit <= 0) {
      omittedItems += 1;
      return { omitted: true } as const;
    }
    const text = value.slice(0, limit);
    remaining -= text.length;
    returnedChars += text.length;
    return {
      omitted: false,
      text,
      ...(text.length < value.length
        ? { truncated: { originalChars: value.length, returnedChars: text.length } }
        : {}),
    } as const;
  }

  const summaries: MessageSummary[] = messages.map((message) => {
    const items: MessageSummary["items"] = [];
    const addText = (type: string, value: string | undefined) => {
      const result = bounded(value);
      if (!result.omitted) items.push({
        type,
        text: result.text,
        ...(result.truncated
          ? { truncated: true, originalChars: result.truncated.originalChars, returnedChars: result.truncated.returnedChars }
          : {}),
      });
    };

    if (message.type === "assistant") {
      for (const item of message.content) {
        if (item.type === "text" || item.type === "reasoning") {
          addText(item.type, item.text);
          continue;
        }
        const summary: MessageSummary["items"][number] = {
          type: "tool",
          name: item.name,
          status: toolStatus(item),
        };
        if (options.includeOutputs && (item.state.status === "completed" || item.state.status === "error")) {
          const raw = item.state.status === "error"
            ? item.state.error.message
            : JSON.stringify(item.state.result ?? item.state.structured);
          const result = bounded(raw);
          if (!result.omitted) {
            summary.output = result.text;
            if (result.truncated) {
              summary.truncated = true;
              summary.originalChars = result.truncated.originalChars;
              summary.returnedChars = result.truncated.returnedChars;
            }
          }
        }
        items.push(summary);
      }
    } else if (message.type === "shell") {
      addText("command", message.command);
      if (options.includeOutputs) {
        const result = bounded(message.output);
        if (!result.omitted) {
          items.push({
            type: "output",
            output: result.text,
            ...(result.truncated
              ? { truncated: true, originalChars: result.truncated.originalChars, returnedChars: result.truncated.returnedChars }
              : {}),
          });
        }
      }
    } else if (message.type === "compaction") {
      addText("summary", message.summary);
      addText("recent", message.recent);
    } else if ("text" in message) {
      addText("text", message.text);
    } else if (message.type === "agent-switched") {
      addText("agent", message.agent);
    } else if (message.type === "model-switched") {
      addText("model", `${message.model.providerID}/${message.model.id}`);
    }

    return {
      id: message.id,
      type: message.type,
      createdAt: "time" in message ? message.time.created : undefined,
      ...(message.type === "assistant" && message.time.completed ? { completedAt: message.time.completed } : {}),
      ...(message.type === "assistant" ? { agent: message.agent } : {}),
      ...(message.type === "assistant"
        ? { model: { providerID: message.model.providerID, modelID: message.model.id } }
        : {}),
      items,
    };
  });

  return {
    messages: summaries,
    truncation: {
      truncated: originalChars > returnedChars,
      originalChars,
      returnedChars,
      maxChars: options.maxTotalChars,
      omittedItems,
    },
  };
}

async function readSession(
  client: NavigatorClient,
  navigator: NavigatorContext,
  args: {
    sessionID: string;
    cursor?: string;
    turnLimit?: number;
    includeOutputs?: boolean;
    maxOutputCharsPerItem?: number;
  },
) {
  const [session, active] = await Promise.all([
    getOwnedSession(client, navigator.projectID, args.sessionID),
    activeSessionIDs(client, navigator),
  ]);
  const limit = Math.min(args.turnLimit ?? 10, 100);
  const payload = navigator.protocol === "v1"
    ? await (async () => {
        const response = await navigator.legacyClient(session.location.directory).session.messages({
          path: { id: args.sessionID },
          query: { limit, ...(args.cursor ? { before: args.cursor } : {}) },
        });
        const messages = responseData(response, `OpenCode messages for session ${args.sessionID}`) as LegacySessionMessage[];
        return {
          data: projectLegacyMessages(messages).reverse(),
          cursor: { next: response.response.headers.get("x-next-cursor") ?? undefined },
        };
      })()
    : responseData(
        await client.v2.session.messages({
          sessionID: args.sessionID,
          limit,
          order: args.cursor ? undefined : "desc",
          cursor: args.cursor,
        }),
        `OpenCode messages for session ${args.sessionID}`,
      );
  const formatted = summarizeMessages(payload.data, {
    includeOutputs: args.includeOutputs ?? false,
    maxItemChars: Math.min(
      args.maxOutputCharsPerItem ?? navigator.config.maxOutputCharsPerItem,
      navigator.config.maxOutputCharsPerItem,
    ),
    maxTotalChars: navigator.config.maxReadChars,
  });
  return {
    session: summarizeSession(session, active),
    messages: formatted.messages,
    ...(payload.cursor.next ? { cursor: payload.cursor.next } : {}),
    truncation: formatted.truncation,
  };
}

function json(value: unknown) {
  return JSON.stringify(value);
}

export function createNavigatorTools(
  input: NavigatorContext & { client: NavigatorClient },
): Record<NavigatorToolName, ToolDefinition> {
  const { client, ...navigator } = input;
  return {
    worktree_list: tool({
      description: "List the current OpenCode project checkout and its managed native worktrees.",
      args: {},
      async execute() {
        return json({
          checkout: { directory: navigator.checkout },
          worktrees: await listManagedWorktrees(client, navigator.checkout),
        });
      },
    }),

    session_create: tool({
      description: "Create and asynchronously prompt a native OpenCode session in the checkout or a managed worktree.",
      args: {
        prompt: tool.schema.string().min(1),
        environment: tool.schema.discriminatedUnion("type", [
          tool.schema.object({ type: tool.schema.literal("checkout") }),
          tool.schema.object({
            type: tool.schema.literal("existing_worktree"),
            directory: tool.schema.string().min(1),
          }),
          tool.schema.object({
            type: tool.schema.literal("new_worktree"),
            name: tool.schema.string().min(1).optional(),
            startCommand: tool.schema.string().min(1).optional(),
          }),
        ]),
        agent: tool.schema.string().min(1).optional(),
        model: tool.schema.object({
          providerID: tool.schema.string().min(1),
          modelID: tool.schema.string().min(1),
        }).optional(),
      },
      async execute(args) {
        const active = await activeSessionIDs(client, navigator);
        const activeSessions = await Promise.all([...active].map((sessionID) => getSession(client, sessionID)));
        const activeOwnedCount = activeSessions.filter((session) => session.projectID === navigator.projectID).length;
        if (activeOwnedCount >= navigator.config.maxConcurrentSessions) {
          throw new Error(`Navigator allows at most ${navigator.config.maxConcurrentSessions} concurrent sessions`);
        }

        let directory = navigator.checkout;
        let createdWorktree: NativeWorktree | undefined;
        if (args.environment.type === "existing_worktree") {
          const requestedDirectory = args.environment.directory;
          const worktrees = await listManagedWorktrees(client, navigator.checkout);
          const requested = worktrees.find((item) => sameDirectory(item.directory, requestedDirectory));
          if (!requested) throw new Error("The requested directory is not a managed OpenCode worktree for this project");
          directory = requested.directory;
        } else if (args.environment.type === "new_worktree") {
          const worktreesBefore = await listManagedWorktrees(client, navigator.checkout);
          try {
            const worktree = responseData(
              await client.worktree.create({
                directory: navigator.checkout,
                worktreeCreateInput: {
                  ...(args.environment.name ? { name: args.environment.name } : {}),
                  ...(args.environment.startCommand ? { startCommand: args.environment.startCommand } : {}),
                },
              }),
              "OpenCode worktree create",
            );
            createdWorktree = normalizeWorktree(worktree);
            directory = createdWorktree.directory;
          } catch (error) {
            const worktreesAfter = await listManagedWorktrees(client, navigator.checkout).catch(() => []);
            const before = new Set(worktreesBefore.map((item) => normalizeDirectory(item.directory)));
            const partial = worktreesAfter.filter((item) => !before.has(normalizeDirectory(item.directory)));
            throw new Error(
              `Navigator could not create the requested worktree: ${error instanceof Error ? error.message : String(error)}` +
              (partial.length ? `. Worktrees created and not removed: ${partial.map((item) => item.directory).join(", ")}` : ""),
            );
          }
        }

        let session: SessionV2Info | { id: string; projectID: string };
        try {
          session = navigator.protocol === "v1"
            ? responseData(
                await navigator.legacyClient(directory).session.create(),
                "OpenCode session create",
              ) as { id: string; projectID: string }
            : envelopeData(
                await client.v2.session.create({
                  ...(args.agent ? { agent: args.agent } : {}),
                  ...(args.model ? { model: { providerID: args.model.providerID, id: args.model.modelID } } : {}),
                  location: { directory },
                }),
                "OpenCode session create",
              );
        } catch (error) {
          throw new Error(
            `Navigator session creation failed: ${error instanceof Error ? error.message : String(error)}` +
            (createdWorktree ? `. Worktree created: ${createdWorktree.name} (${createdWorktree.directory}) and was not removed` : ""),
          );
        }
        if (session.projectID !== navigator.projectID) {
          throw new Error(`Created session ${session.id} belongs to an unexpected project; it was not prompted`);
        }

        try {
          if (navigator.protocol === "v1") {
            const response = await navigator.legacyClient(directory).session.promptAsync({
              path: { id: session.id },
              body: {
                parts: [{ type: "text", text: args.prompt }],
                ...(args.agent ? { agent: args.agent } : {}),
                ...(args.model ? { model: args.model } : {}),
              },
            });
            if (response.error !== undefined) failResponse(response.error, `OpenCode prompt admission for session ${session.id}`);
          } else {
            envelopeData(
              await client.v2.session.prompt({
                sessionID: session.id,
                prompt: { text: args.prompt },
                delivery: "steer",
              }),
              `OpenCode prompt admission for session ${session.id}`,
            );
          }
        } catch (error) {
          throw new Error(
            `Navigator prompt admission failed: ${error instanceof Error ? error.message : String(error)}. Session created: ${session.id}` +
            (createdWorktree ? `. Worktree created: ${createdWorktree.name} (${createdWorktree.directory})` : ""),
          );
        }

        return json({
          sessionID: session.id,
          directory,
          ...(createdWorktree
            ? { worktree: { created: true, name: createdWorktree.name, ...(createdWorktree.branch ? { branch: createdWorktree.branch } : {}) } }
            : {}),
        });
      },
    }),

    session_list: tool({
      description: "List native OpenCode sessions owned by the current project.",
      args: {
        directory: tool.schema.string().optional(),
        search: tool.schema.string().optional(),
        limit: tool.schema.number().int().positive().max(100).optional(),
        cursor: tool.schema.string().optional(),
      },
      async execute(args) {
        if (args.directory) {
          const managed = await listManagedWorktrees(client, navigator.checkout);
          const valid = [navigator.checkout, ...managed.map((item) => item.directory)]
            .some((directory) => sameDirectory(directory, args.directory!));
          if (!valid) throw new Error("The requested directory is not a managed OpenCode worktree for this project");
        }
        const [payload, active] = await Promise.all([
          client.v2.session.list({
            project: navigator.projectID,
            directory: args.directory,
            search: args.search,
            limit: args.limit,
            cursor: args.cursor,
          }).then((response) => responseData(response, "OpenCode session list")),
          activeSessionIDs(client, navigator),
        ]);
        const owned = payload.data.filter((session) => session.projectID === navigator.projectID);
        return json({
          sessions: owned.map((session) => summarizeSession(session, active)),
          ...(payload.cursor.next ? { cursor: payload.cursor.next } : {}),
        });
      },
    }),

    session_read: tool({
      description: "Read a bounded page of recent messages from a current-project OpenCode session.",
      args: {
        sessionID: tool.schema.string().min(1),
        cursor: tool.schema.string().optional(),
        turnLimit: tool.schema.number().int().positive().max(100).optional(),
        includeOutputs: tool.schema.boolean().optional(),
        maxOutputCharsPerItem: tool.schema.number().int().positive().optional(),
      },
      async execute(args) {
        return json(await readSession(client, navigator, args));
      },
    }),

    session_send: tool({
      description: "Steer a prompt for an existing current-project OpenCode session.",
      args: {
        sessionID: tool.schema.string().min(1),
        prompt: tool.schema.string().min(1),
      },
      async execute(args, context) {
        assertNotCallingSession(args.sessionID, context, "send to");
        const session = await getOwnedSession(client, navigator.projectID, args.sessionID);
        if (navigator.protocol === "v1") {
          const response = await navigator.legacyClient(session.location.directory).session.promptAsync({
            path: { id: args.sessionID },
            body: { parts: [{ type: "text", text: args.prompt }] },
          });
          if (response.error !== undefined) failResponse(response.error, `OpenCode prompt admission for session ${args.sessionID}`);
          return json({ sessionID: args.sessionID, admitted: true });
        }
        const admitted = envelopeData(await client.v2.session.prompt({
          sessionID: args.sessionID,
          prompt: { text: args.prompt },
          delivery: "steer",
        }), `OpenCode prompt admission for session ${args.sessionID}`);
        return json({ sessionID: args.sessionID, admitted: Boolean(admitted) });
      },
    }),

    session_wait: tool({
      description: "Wait for the first of one to eight current-project OpenCode sessions to become idle.",
      args: {
        targets: tool.schema.array(tool.schema.object({ sessionID: tool.schema.string().min(1) })).min(1).max(8),
        timeoutMs: tool.schema.number().int().nonnegative().optional(),
      },
      async execute(args, context) {
        const ids = args.targets.map((target) => target.sessionID);
        if (new Set(ids).size !== ids.length) throw new Error("Navigator wait targets must be unique");
        for (const id of ids) assertNotCallingSession(id, context, "wait for");
        const sessions = await Promise.all(ids.map((id) => getOwnedSession(client, navigator.projectID, id)));
        let active = await activeSessionIDs(client, navigator);
        const alreadyIdle = sessions.find((session) => !active.has(session.id));
        if (alreadyIdle) {
          const completed = await readSession(client, navigator, { sessionID: alreadyIdle.id });
          return json({ status: "completed", completed });
        }

        const timeoutMs = Math.min(args.timeoutMs ?? navigator.config.maxWaitMs, navigator.config.maxWaitMs);
        if (timeoutMs === 0) {
          return json({
            status: "timeout",
            active: sessions.map((session) => summarizeSession(session, active)),
          });
        }

        // OpenCode's V2 wait endpoint is unavailable, so poll process-global active ownership locally.
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          await waitFor(Math.min(250, deadline - Date.now()), context.abort);
          active = await activeSessionIDs(client, navigator);
          const completedSession = sessions.find((session) => !active.has(session.id));
          if (completedSession) {
            const completed = await readSession(client, navigator, { sessionID: completedSession.id });
            return json({ status: "completed", completed });
          }
        }
        return json({
          status: "timeout",
          active: sessions.filter((session) => active.has(session.id)).map((session) => summarizeSession(session, active)),
        });
      },
    }),

    session_interrupt: tool({
      description: "Interrupt active execution in a current-project OpenCode session.",
      args: { sessionID: tool.schema.string().min(1) },
      async execute(args, context) {
        assertNotCallingSession(args.sessionID, context, "interrupt");
        const session = await getOwnedSession(client, navigator.projectID, args.sessionID);
        const response = navigator.protocol === "v1"
          ? await navigator.legacyClient(session.location.directory).session.abort({ path: { id: args.sessionID } })
          : await client.v2.session.interrupt({ sessionID: args.sessionID });
        if (response.error !== undefined) failResponse(response.error, `OpenCode interrupt for session ${args.sessionID}`);
        return json({ sessionID: args.sessionID, interrupted: true });
      },
    }),

    worktree_remove: tool({
      description: "Remove an idle managed OpenCode worktree from the current project without force.",
      args: { directory: tool.schema.string().min(1) },
      async execute(args) {
        if (sameDirectory(args.directory, navigator.checkout)) {
          throw new Error("Navigator refuses to remove the main checkout");
        }
        const worktrees = await listManagedWorktrees(client, navigator.checkout);
        const managed = worktrees.find((item) => sameDirectory(item.directory, args.directory));
        if (!managed) throw new Error("The requested directory is not a managed OpenCode worktree");

        const active = await activeSessionIDs(client, navigator);
        for (const sessionID of active) {
          const session = await getSession(client, sessionID);
          if (session.projectID !== navigator.projectID) continue;
          if (sameDirectory(session.location.directory, managed.directory)) {
            throw new Error(`Navigator refuses to remove a worktree containing active session ${sessionID}`);
          }
        }
        const removed = responseData(
          await client.worktree.remove({
            directory: navigator.checkout,
            worktreeRemoveInput: { directory: managed.directory },
          }),
          `OpenCode worktree removal for ${managed.directory}`,
        );
        return json({ removed: Boolean(removed) });
      },
    }),
  };
}

export async function checkNavigatorCompatibility(client: NavigatorClient, checkout: string) {
  await listManagedWorktrees(client, checkout);
}

export async function detectNavigatorProtocol(client: NavigatorClient): Promise<NavigatorProtocol> {
  try {
    const health = responseData(await client.global.health(), "OpenCode health") as { healthy?: boolean };
    if (health.healthy === true) return "v1";
  } catch {
    // Continue with the current health probe, matching OpenCode Desktop.
  }
  try {
    const health = responseData(await client.v2.health.get(), "OpenCode V2 health") as {
      healthy?: boolean;
      pid?: number;
    };
    if (typeof health.pid === "number") return "v2";
    if (health.healthy === true) return "v1";
  } catch {
    // Desktop defaults to V2 when neither health shape can be identified.
  }
  return "v2";
}

export async function getNavigatorCompatibilityWarning(
  client: NavigatorClient,
  protocol: NavigatorProtocol,
  legacyClient?: NavigatorLegacyClient,
) {
  const v2Metadata = hasMethods(client.worktree, ["list"]) && hasMethods(client.v2?.session, ["list", "get"]);
  const compatible = protocol === "v1"
    ? v2Metadata && hasMethods(legacyClient?.session, ["create", "promptAsync", "status", "messages", "abort"])
    : v2Metadata && hasMethods(client.v2.session, ["create", "messages", "prompt", "active", "interrupt"]);
  if (!compatible) {
    return `Kompass Navigator requires OpenCode 1.17.12 or newer with ${protocol.toUpperCase()} session and worktree APIs`;
  }
  if (!client.global?.health) return;
  try {
    const health = responseData(await client.global.health(), "OpenCode health") as { version?: string };
    if (health.version && compareVersions(health.version, "1.17.12") < 0) {
      return `Kompass Navigator requires OpenCode 1.17.12 or newer (running ${health.version})`;
    }
  } catch (error) {
    return `Kompass Navigator could not verify OpenCode compatibility: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function hasMethods(value: unknown, names: string[]) {
  if (!value || typeof value !== "object") return false;
  return names.every((name) => typeof Reflect.get(value, name) === "function");
}

function waitFor(timeoutMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("Navigator wait aborted"));
      return;
    }
    const timer = setTimeout(done, timeoutMs);
    signal.addEventListener("abort", aborted, { once: true });
    function done() {
      signal.removeEventListener("abort", aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Navigator wait aborted"));
    }
  });
}

function compareVersions(left: string, right: string) {
  const a = left.split(".").map((value) => Number.parseInt(value, 10) || 0);
  const b = right.split(".").map((value) => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}
