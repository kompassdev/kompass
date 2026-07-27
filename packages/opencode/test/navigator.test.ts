import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createNavigatorTools, detectNavigatorProtocol, getNavigatorCompatibilityWarning } from "../navigator.ts";

const navigatorConfig = {
  enabled: true,
  maxConcurrentSessions: 8,
  maxReadChars: 20_000,
  maxOutputCharsPerItem: 4_000,
  maxWaitMs: 120_000,
};

function response<T>(data: T) {
  return { data, error: undefined };
}

function session(id: string, directory = "/repo", projectID = "project-1") {
  return {
    id,
    projectID,
    title: id,
    location: { directory },
    time: { created: 1, updated: 2 },
  };
}

function createClient(overrides: Record<string, any> = {}) {
  const sessions = [session("session-1")];
  const client: Record<string, any> = {
    worktree: {
      list: async () => response(["/repo-worktree"]),
      create: async () => response({ directory: "/repo-new", name: "new", branch: "new" }),
      remove: async () => response(true),
    },
    v2: {
      session: {
        active: async () => response({ data: {} }),
        get: async ({ sessionID }: { sessionID: string }) => response({
          data: sessions.find((item) => item.id === sessionID) ?? session(sessionID),
        }),
        list: async () => response({ data: sessions, cursor: {} }),
        messages: async () => response({ data: [], cursor: {} }),
        create: async ({ location }: any) => response({ data: session("created", location.directory) }),
        prompt: async ({ sessionID }: any) => response({ data: { sessionID } }),
        switchAgent: async () => response(undefined),
        switchModel: async () => response(undefined),
        wait: async () => response(undefined),
        interrupt: async () => response(undefined),
      },
    },
    session: {
      status: async () => response({}),
      create: async () => response(session("created")),
      promptAsync: async () => response(undefined),
      abort: async () => response(true),
      messages: async () => ({ ...response([]), response: new Response() }),
    },
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "worktree") Object.assign(client.worktree, value);
    else if (key === "session") Object.assign(client.v2.session, value);
    else if (key === "legacySession") Object.assign(client.session, value);
    else client[key] = value;
  }
  return client;
}

function tools(client = createClient(), config = navigatorConfig, protocol: "v1" | "v2" = "v2") {
  return createNavigatorTools({
    client: client as never,
    legacyClient: () => client as never,
    config,
    projectID: "project-1",
    checkout: "/repo",
    protocol,
  });
}

function context(sessionID = "caller", abort = new AbortController().signal) {
  return { sessionID, abort } as never;
}

describe("Kompass Navigator", () => {
  test("matches Desktop protocol detection", async () => {
    const legacy = createClient({
      global: { health: async () => response({ healthy: true }) },
    });
    assert.equal(await detectNavigatorProtocol(legacy as never), "v1");

    const current = createClient({
      global: { health: async () => { throw new Error("not found"); } },
    });
    current.v2.health = { get: async () => response({ pid: 123 }) };
    assert.equal(await detectNavigatorProtocol(current as never), "v2");
  });

  test("lists the checkout and managed worktrees", async () => {
    const output = JSON.parse(await (tools().worktree_list as any).execute({}, context()));
    assert.deepEqual(output.checkout, { directory: "/repo" });
    assert.deepEqual(output.worktrees, [{ directory: "/repo-worktree", name: "repo-worktree", type: "worktree" }]);
  });

  test("rejects foreign sessions", async () => {
    const client = createClient({
      session: { get: async () => response({ data: session("foreign", "/repo", "project-2") }) },
    });
    await assert.rejects(
      (tools(client).session_read as any).execute({ sessionID: "foreign" }, context()),
      /does not belong to the current OpenCode project/,
    );
  });

  test("filters session lists to the current project", async () => {
    const queries: any[] = [];
    const client = createClient({
      session: {
        list: async (args: any) => {
          queries.push(args);
          return response({
            data: [session("owned"), session("foreign", "/repo", "project-2")],
            cursor: {},
          });
        },
      },
    });
    const output = JSON.parse(await (tools(client).session_list as any).execute({}, context()));

    assert.equal(queries[0].project, "project-1");
    assert.deepEqual(output.sessions.map((item: any) => item.sessionID), ["owned"]);
  });

  test("rejects arbitrary existing worktree paths", async () => {
    await assert.rejects(
      (tools().session_create as any).execute({
        prompt: "work",
        environment: { type: "existing_worktree", directory: "/tmp/arbitrary" },
      }, context()),
      /not a managed OpenCode workspace/,
    );
  });

  test("rejects arbitrary session-list directories", async () => {
    await assert.rejects(
      (tools().session_list as any).execute({ directory: "/tmp/arbitrary" }, context()),
      /not a managed OpenCode workspace/,
    );
  });

  test("creates in the selected directory and admits the prompt", async () => {
    const creates: any[] = [];
    const prompts: any[] = [];
    const client = createClient({
      session: {
        create: async (args: any) => {
          creates.push(args);
          return response({ data: session("created", args.location.directory) });
        },
        prompt: async (args: any) => {
          prompts.push(args);
          return response({ data: { sessionID: args.sessionID } });
        },
      },
    });
    const output = JSON.parse(await (tools(client).session_create as any).execute({
      prompt: "implement it",
      environment: { type: "existing_worktree", directory: "/repo-worktree" },
    }, context()));

    assert.equal(output.directory, "/repo-worktree");
    assert.equal(creates[0].location.directory, "/repo-worktree");
    assert.equal(prompts[0].prompt.text, "implement it");
  });

  test("uses one legacy transcript path when Desktop selects V1", async () => {
    const prompts: any[] = [];
    const client = createClient({
      legacySession: {
        promptAsync: async (args: any) => {
          prompts.push(args);
          return response(undefined);
        },
        messages: async () => ({
          ...response([{
            info: {
              id: "user-1",
              sessionID: "session-1",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "provider", modelID: "model" },
            },
            parts: [{ id: "part-1", sessionID: "session-1", messageID: "user-1", type: "text", text: "visible" }],
          }]),
          response: new Response(),
        }),
      },
    });
    const navigator = tools(client, navigatorConfig, "v1");

    await (navigator.session_send as any).execute({ sessionID: "session-1", prompt: "follow up" }, context());
    const output = JSON.parse(await (navigator.session_read as any).execute({ sessionID: "session-1" }, context()));

    assert.equal(prompts[0].body.parts[0].text, "follow up");
    assert.equal(output.messages[0].items[0].text, "visible");
  });

  test("preserves legacy errored tool output text", async () => {
    const client = createClient({
      legacySession: {
        messages: async () => ({
          ...response([{
            info: {
              id: "assistant-1",
              sessionID: "session-1",
              role: "assistant",
              time: { created: 1, completed: 2 },
              mode: "build",
              providerID: "provider",
              modelID: "model",
            },
            parts: [{
              id: "tool-1",
              sessionID: "session-1",
              messageID: "assistant-1",
              type: "tool",
              tool: "bash",
              state: {
                status: "error",
                input: { command: "false" },
                error: "command failed",
                time: { start: 1, end: 2 },
              },
            }],
          }]),
          response: new Response(),
        }),
      },
    });

    const output = JSON.parse(await (tools(client, navigatorConfig, "v1").session_read as any).execute({
      sessionID: "session-1",
      includeOutputs: true,
    }, context()));

    assert.equal(output.messages[0].items[0].status, "error");
    assert.equal(output.messages[0].items[0].output, "command failed");
  });

  test("returns new worktree details", async () => {
    const output = JSON.parse(await (tools().session_create as any).execute({
      prompt: "implement it",
      environment: { type: "new_worktree", name: "feature" },
    }, context()));
    assert.deepEqual(output.worktree, { created: true, type: "worktree", name: "new", branch: "new" });
  });

  test("prefers Rift workspace adapter for new workspaces when available", async () => {
    const workspaceCreates: any[] = [];
    const sessionCreates: any[] = [];
    const client = createClient({
      session: {
        create: async (args: any) => {
          sessionCreates.push(args);
          return response({ data: session("created", args.location.directory) });
        },
      },
    });
    client.experimental = {
      workspace: {
        adapter: { list: async () => response([{ type: "worktree" }, { type: "rift" }]) },
        syncList: async () => response(undefined),
        list: async () => response([]),
        create: async (args: any) => {
          workspaceCreates.push(args);
          return response({
            id: "wrk_rift",
            type: "rift",
            name: "parser-fix",
            directory: "/repo-rift",
            projectID: "project-1",
          });
        },
        remove: async () => response(undefined),
      },
    };

    const output = JSON.parse(await (tools(client).session_create as any).execute({
      prompt: "implement it",
      environment: { type: "new_worktree", name: "Parser Fix" },
    }, context()));

    assert.deepEqual(workspaceCreates, [{ directory: "/repo", type: "rift", extra: { name: "Parser Fix" } }]);
    assert.equal(sessionCreates[0].location.directory, "/repo-rift");
    assert.deepEqual(output.worktree, { created: true, type: "rift", name: "parser-fix" });
  });

  test("reports resources created before a prompt failure", async () => {
    const client = createClient({ session: { prompt: async () => { throw new Error("admission failed"); } } });
    await assert.rejects(
      (tools(client).session_create as any).execute({
        prompt: "implement it",
        environment: { type: "new_worktree" },
      }, context()),
      /Session created: created.*Worktree created: new \(\/repo-new\)/,
    );
  });

  test("reports a worktree created before a session failure", async () => {
    const client = createClient({ session: { create: async () => { throw new Error("create failed"); } } });
    await assert.rejects(
      (tools(client).session_create as any).execute({
        prompt: "implement it",
        environment: { type: "new_worktree" },
      }, context()),
      /Worktree created: new \(\/repo-new\).*was not removed/,
    );
  });

  test("discovers a worktree left behind by a failed native create", async () => {
    let created = false;
    const client = createClient({
      worktree: {
        list: async () => response(created ? ["/repo-partial"] : []),
        create: async () => {
          created = true;
          throw new Error("start command failed");
        },
      },
    });
    await assert.rejects(
      (tools(client).session_create as any).execute({
        prompt: "implement it",
        environment: { type: "new_worktree", startCommand: "false" },
      }, context()),
      /Workspaces created and not removed: \/repo-partial/,
    );
  });

  test("rejects self send, wait, and interrupt", async () => {
    const navigator = tools();
    await assert.rejects(
      (navigator.session_send as any).execute({ sessionID: "caller", prompt: "x" }, context()),
      /cannot target the calling session/,
    );
    await assert.rejects(
      (navigator.session_wait as any).execute({ targets: [{ sessionID: "caller" }] }, context()),
      /cannot target the calling session/,
    );
    await assert.rejects(
      (navigator.session_interrupt as any).execute({ sessionID: "caller" }, context()),
      /cannot target the calling session/,
    );
  });

  test("switches context, sends steer, and interrupts through V2", async () => {
    const prompts: any[] = [];
    const interrupts: any[] = [];
    const agentSwitches: any[] = [];
    const modelSwitches: any[] = [];
    const client = createClient({
      session: {
        prompt: async (args: any) => {
          prompts.push(args);
          return response({ data: { sessionID: args.sessionID } });
        },
        switchAgent: async (args: any) => {
          agentSwitches.push(args);
          return response(undefined);
        },
        switchModel: async (args: any) => {
          modelSwitches.push(args);
          return response(undefined);
        },
        interrupt: async (args: any) => {
          interrupts.push(args);
          return response(undefined);
        },
      },
    });
    const navigator = tools(client);
    await (navigator.session_send as any).execute(
      {
        sessionID: "session-1",
        prompt: "steer",
        agent: "worker",
        model: { providerID: "openai", modelID: "gpt-5.5" },
      },
      context(),
    );
    await (navigator.session_interrupt as any).execute(
      { sessionID: "session-1" },
      context(),
    );

    assert.deepEqual(agentSwitches, [{ sessionID: "session-1", agent: "worker" }]);
    assert.deepEqual(modelSwitches, [{
      sessionID: "session-1",
      model: { providerID: "openai", id: "gpt-5.5" },
    }]);
    assert.equal(prompts[0].delivery, "steer");
    assert.deepEqual(interrupts, [{ sessionID: "session-1" }]);
  });

  test("wait polls V2 active sessions until the first completion", async () => {
    let activeCalls = 0;
    const client = createClient({
      session: {
        active: async () => response({ data: activeCalls++ === 0
          ? { one: { type: "running" }, two: { type: "running" } }
          : { two: { type: "running" } } }),
        wait: async () => { throw new Error("Unavailable V2 wait must not be used"); },
      },
    });
    const output = JSON.parse(await (tools(client).session_wait as any).execute({
      targets: [{ sessionID: "one" }, { sessionID: "two" }],
      timeoutMs: 500,
    }, context()));
    assert.equal(output.status, "completed");
    assert.equal(output.completed.session.sessionID, "one");
  });

  test("wait stops active-session polling when its invocation is cancelled", async () => {
    const controller = new AbortController();
    const client = createClient({
      session: {
        wait: async () => { throw new Error("V2 wait must not be used"); },
        active: async () => response({ data: { one: { type: "running" } } }),
      },
    });
    const waiting = (tools(client).session_wait as any).execute({
      targets: [{ sessionID: "one" }],
      timeoutMs: 500,
    }, context("caller", controller.signal));
    controller.abort(new Error("cancelled by caller"));
    await assert.rejects(waiting, /cancelled by caller/);
  });

  test("immediate wait returns an active snapshot", async () => {
    const client = createClient({
      session: { active: async () => response({ data: { one: { type: "running" } } }) },
    });
    const output = JSON.parse(await (tools(client).session_wait as any).execute({
      targets: [{ sessionID: "one" }],
      timeoutMs: 0,
    }, context()));
    assert.equal(output.status, "timeout");
    assert.equal(output.active[0].state, "active");
  });

  test("bounds transcript items and total output", async () => {
    const client = createClient({
      session: {
        messages: async () => response({
          data: [
            { id: "m1", type: "user", time: { created: 1 }, text: "abcdefghij" },
            { id: "m2", type: "user", time: { created: 2 }, text: "klmnopqrst" },
          ],
          cursor: {},
        }),
      },
    });
    const output = JSON.parse(await (tools(client, {
      ...navigatorConfig,
      maxReadChars: 7,
      maxOutputCharsPerItem: 5,
    }).session_read as any).execute({ sessionID: "session-1" }, context()));
    assert.equal(output.messages[0].items[0].text.length, 5);
    assert.equal(output.messages[0].items[0].truncated, true);
    assert.equal(output.messages[1].items[0].text.length, 2);
  });

  test("guards checkout, unmanaged, and active worktree removal", async () => {
    const navigator = tools();
    await assert.rejects(
      (navigator.worktree_remove as any).execute({ directory: "/repo" }, context()),
      /main checkout/,
    );
    await assert.rejects(
      (navigator.worktree_remove as any).execute({ directory: "/other" }, context()),
      /not a managed OpenCode workspace/,
    );
    const activeClient = createClient({
      session: {
        active: async () => response({ data: { active: { type: "running" } } }),
        get: async () => response({ data: session("active", "/repo-worktree") }),
      },
    });
    await assert.rejects(
      (tools(activeClient).worktree_remove as any).execute({ directory: "/repo-worktree" }, context()),
      /active session/,
    );

    const output = JSON.parse(await (navigator.worktree_remove as any).execute(
      { directory: "/repo-worktree" },
      context(),
    ));
    assert.deepEqual(output, { removed: true });
  });

  test("removes managed Rift workspaces through the workspace API", async () => {
    const removes: any[] = [];
    let lists = 0;
    const client = createClient();
    const riftWorkspace = {
      id: "wrk_rift",
      type: "rift",
      name: "parser-fix",
      directory: "/repo-rift",
      projectID: "project-1",
    };
    client.experimental = {
      workspace: {
        adapter: { list: async () => response([{ type: "rift" }]) },
        syncList: async () => response(undefined),
        list: async () => response(++lists < 3 ? [riftWorkspace] : []),
        create: async () => response(undefined),
        remove: async (args: any) => {
          removes.push(args);
          return response(undefined);
        },
      },
    };

    const output = JSON.parse(await (tools(client).worktree_remove as any).execute(
      { directory: "/repo-rift" },
      context(),
    ));

    assert.deepEqual(output, { removed: true });
    assert.deepEqual(removes, [
      { id: "wrk_rift", directory: "/repo" },
      { id: "wrk_rift", directory: "/repo" },
    ]);
  });

  test("guards active Rift workspaces when polling active sessions through V1", async () => {
    const statusDirectories: string[] = [];
    const client = createClient({
      session: {
        get: async () => response({ data: session("rift-active", "/repo-rift") }),
      },
    });
    client.experimental = {
      workspace: {
        adapter: { list: async () => response([{ type: "rift" }]) },
        syncList: async () => response(undefined),
        list: async () => response([{
          id: "wrk_rift",
          type: "rift",
          name: "parser-fix",
          directory: "/repo-rift",
          projectID: "project-1",
        }]),
        create: async () => response(undefined),
        remove: async () => response(undefined),
      },
    };
    const navigator = createNavigatorTools({
      client: client as never,
      legacyClient: (directory: string) => ({
        ...client,
        session: {
          ...client.session,
          status: async () => {
            statusDirectories.push(directory);
            return response(directory === "/repo-rift" ? { "rift-active": { type: "running" } } : {});
          },
        },
      }) as never,
      config: navigatorConfig,
      projectID: "project-1",
      checkout: "/repo",
      protocol: "v1",
    });

    await assert.rejects(
      (navigator.worktree_remove as any).execute({ directory: "/repo-rift" }, context()),
      /active session rift-active/,
    );
    assert.ok(statusDirectories.includes("/repo-rift"));
  });

  test("fails closed when active-session lookup fails during worktree removal", async () => {
    const client = createClient({
      session: {
        active: async () => response({ data: { active: { type: "running" } } }),
        get: async () => { throw new Error("connection lost"); },
      },
    });
    await assert.rejects(
      (tools(client).worktree_remove as any).execute({ directory: "/repo-worktree" }, context()),
      /connection lost/,
    );
  });

  test("discovers existing sessions after reinitialization", async () => {
    const client = createClient();
    const first = JSON.parse(await (tools(client).session_list as any).execute({}, context()));
    const second = JSON.parse(await (tools(client).session_list as any).execute({}, context()));
    assert.deepEqual(second.sessions, first.sessions);
  });

  test("reports incompatible OpenCode runtime versions", async () => {
    const client = createClient({
      global: { health: async () => response({ version: "1.17.11" }) },
    });
    assert.match(
      await getNavigatorCompatibilityWarning(client as never, "v2") ?? "",
      /requires OpenCode 1\.17\.12 or newer/,
    );

    client.global.health = async () => response({ version: "1.17.12" });
    assert.equal(await getNavigatorCompatibilityWarning(client as never, "v2"), undefined);
  });
});
