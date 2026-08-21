import { Plugin } from "@opencode-ai/plugin";
import { Schema } from "effect";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  createChangesLoadTool,
  createPrLoadReviewTool,
  createPrLoadTool,
  createPrSyncTool,
  createTicketLoadTool,
  createTicketSyncTool,
  getEnabledToolNames,
  type MergedKompassConfig,
  type Shell,
  type ShellPromise,
} from "../core/index.ts";
import { loadMergedKompassConfig, loadResolvedAgents, loadResolvedCommands } from "./cache.ts";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";
import { createPluginLogger, getErrorDetails } from "./logging.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";

const execFileAsync = promisify(execFile);

type PluginContext = Plugin.Context;
type ToolDraft = Parameters<Parameters<PluginContext["tool"]["transform"]>[0]>[0];
type OpenCodeTool = Parameters<ToolDraft["add"]>[0];

type ShellResult = ShellPromise & {
  stdout: Buffer;
};

type CoreTool = {
  description: string;
  execute(args: never, context: { worktree: string; directory: string }): Promise<string>;
};

function shellEscape(value: unknown): string {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function shellResult(stdout: string, stderr: string, exitCode: number): ShellResult {
  return {
    cwd: () => {
      throw new Error("Cannot change cwd after execution");
    },
    quiet: () => {
      throw new Error("Cannot change quiet after execution");
    },
    nothrow: () => {
      throw new Error("Cannot change nothrow after execution");
    },
    text: () => stdout,
    json: () => JSON.parse(stdout),
    exitCode,
    stderr: Buffer.from(stderr),
    stdout: Buffer.from(stdout),
  };
}

class NodeShellCommand implements PromiseLike<ShellResult> {
  #command: string;
  #cwd: string;
  #quiet = false;
  #nothrow = false;
  #result?: Promise<ShellResult>;

  constructor(command: string, cwd: string) {
    this.#command = command;
    this.#cwd = cwd;
  }

  cwd(dir: string) {
    this.#cwd = dir;
    return this;
  }

  quiet() {
    this.#quiet = true;
    return this;
  }

  nothrow() {
    this.#nothrow = true;
    return this;
  }

  then<TResult1 = ShellResult, TResult2 = never>(
    onfulfilled?: ((value: ShellResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(onfulfilled, onrejected);
  }

  private run() {
    this.#result ??= this.execute();
    return this.#result;
  }

  private async execute() {
    try {
      const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", this.#command], {
        cwd: this.#cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      this.write(stdout, stderr);
      return shellResult(stdout, stderr, 0);
    } catch (error) {
      const failed = error as { stdout?: unknown; stderr?: unknown; message?: unknown; code?: unknown };
      const stdout = String(failed.stdout ?? "");
      const stderr = String(failed.stderr ?? failed.message ?? "");
      const exitCode = typeof failed.code === "number" ? failed.code : 1;
      const result = shellResult(stdout, stderr, exitCode);

      this.write(stdout, stderr);
      if (this.#nothrow) return result;

      throw new Error(stderr || `Command failed: ${this.#command}`);
    }
  }

  private write(stdout: string, stderr: string) {
    if (this.#quiet) return;
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
}

function createNodeShell(defaultDirectory: string): Shell {
  return (strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0] ?? "";

    expressions.forEach((expression, index) => {
      command += Array.isArray(expression)
        ? expression.map((item) => shellEscape(item)).join(" ")
        : shellEscape(expression);
      command += strings[index + 1] ?? "";
    });

    return new NodeShellCommand(command, defaultDirectory) as unknown as ShellPromise;
  };
}

const checklist = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(Schema.Struct({
    name: Schema.String,
    completed: Schema.Boolean,
  })),
});

const toolInputs = {
  changes_load: Schema.Struct({
    base: Schema.optional(Schema.String),
    head: Schema.optional(Schema.String),
    depthHint: Schema.optional(Schema.Int),
    uncommitted: Schema.optional(Schema.Boolean),
  }),
  pr_load: Schema.Struct({ pr: Schema.optional(Schema.String) }),
  pr_load_review: Schema.Struct({
    pr: Schema.optional(Schema.String),
    since: Schema.String,
  }),
  ticket_load: Schema.Struct({
    source: Schema.String,
    comments: Schema.optional(Schema.Boolean),
  }),
  ticket_sync: Schema.Struct({
    title: Schema.optional(Schema.String),
    body: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    labels: Schema.optional(Schema.Array(Schema.String)),
    assignees: Schema.optional(Schema.Array(Schema.String)),
    checklists: Schema.optional(Schema.Array(checklist)),
    refUrl: Schema.optional(Schema.String),
    comments: Schema.optional(Schema.Array(Schema.String)),
  }),
};

function prSyncInput(allowApprove: boolean) {
  const review = Schema.Struct({
    body: Schema.optional(Schema.String),
    comments: Schema.optional(Schema.Array(Schema.Struct({
      path: Schema.String,
      body: Schema.String,
      line: Schema.Int,
      startLine: Schema.optional(Schema.Int),
      side: Schema.optional(Schema.Literals(["LEFT", "RIGHT"])),
      startSide: Schema.optional(Schema.Literals(["LEFT", "RIGHT"])),
    }))),
    ...(allowApprove ? { approve: Schema.optional(Schema.Boolean) } : {}),
  });

  return Schema.Struct({
    title: Schema.optional(Schema.String),
    body: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    base: Schema.optional(Schema.String),
    head: Schema.optional(Schema.String),
    labels: Schema.optional(Schema.Array(Schema.String)),
    removeLabels: Schema.optional(Schema.Array(Schema.String)),
    replaceLabels: Schema.optional(Schema.Array(Schema.String)),
    assignees: Schema.optional(Schema.Array(Schema.String)),
    checklists: Schema.optional(Schema.Array(checklist)),
    draft: Schema.optional(Schema.Boolean),
    refUrl: Schema.optional(Schema.String),
    commitId: Schema.optional(Schema.String),
    review: Schema.optional(review),
    replies: Schema.optional(Schema.Array(Schema.Struct({
      inReplyTo: Schema.Int,
      body: Schema.String,
    }))),
    commentBody: Schema.optional(Schema.String),
  });
}

function toOpenCodeTool(
  name: string,
  definition: CoreTool,
  input: OpenCodeTool["input"],
  projectRoot: string,
): OpenCodeTool {
  return {
    name,
    description: definition.description,
    input,
    output: Schema.Unknown,
    options: { codemode: false },
    async execute(args) {
      const content = await definition.execute(args as never, {
        worktree: projectRoot,
        directory: projectRoot,
      });
      return { output: JSON.parse(content), content };
    },
  };
}

export async function createOpenCodeTools(projectRoot: string): Promise<OpenCodeTool[]> {
  const config = await loadMergedKompassConfig(projectRoot);
  const shell = createNodeShell(projectRoot);
  const creators: Record<string, { definition: CoreTool; input: OpenCodeTool["input"] }> = {
    changes_load: { definition: createChangesLoadTool(shell) as CoreTool, input: toolInputs.changes_load },
    pr_load: { definition: createPrLoadTool(shell) as CoreTool, input: toolInputs.pr_load },
    pr_load_review: { definition: createPrLoadReviewTool(shell) as CoreTool, input: toolInputs.pr_load_review },
    pr_sync: {
      definition: createPrSyncTool(shell) as CoreTool,
      input: prSyncInput(config.shared.prApprove) as unknown as OpenCodeTool["input"],
    },
    ticket_load: { definition: createTicketLoadTool(shell) as CoreTool, input: toolInputs.ticket_load },
    ticket_sync: { definition: createTicketSyncTool(shell) as CoreTool, input: toolInputs.ticket_sync },
  };

  return getEnabledToolNames(config.tools).flatMap((toolName) => {
    const creator = creators[toolName];
    if (!creator) return [];
    const registeredName = getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name);
    return [toOpenCodeTool(registeredName, creator.definition, creator.input, projectRoot)];
  });
}

async function setup(ctx: PluginContext) {
  const location = await ctx.agent.list();
  const projectRoot = location.location.directory;
  const logger = createPluginLogger(projectRoot);

  try {
    const [agents, commands, tools] = await Promise.all([
      loadResolvedAgents(projectRoot),
      loadResolvedCommands(projectRoot),
      createOpenCodeTools(projectRoot),
    ]);

    await ctx.agent.transform((draft) => applyAgentsConfig(draft, agents, { logger }));
    await ctx.command.transform((draft) => applyCommandsConfig(draft, commands, { logger }));
    await ctx.tool.transform((draft) => {
      for (const tool of tools) draft.add(tool);
    });

    logger.info("Initialized Kompass v2 plugin", {
      directory: projectRoot,
      tools: tools.length,
    });
  } catch (error) {
    logger.error("Failed to initialize Kompass v2 plugin", getErrorDetails(error));
    throw error;
  }
}

export const OpenCodeCompassPlugin = Plugin.define({
  id: "kompass",
  setup,
});

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPlugin;
