import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  createChangesLoadTool,
  createCommandExpansionTool,
  createPrLoadTool,
  createPrSyncTool,
  createTicketLoadTool,
  createTicketSyncTool,
  getEnabledToolNames,
  type MergedKompassConfig,
  type Shell,
  type ShellPromise,
} from "../core/index.ts";
import { loadConfiguredNames, loadMergedKompassConfig } from "./cache.ts";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";
import { createPluginLogger, getErrorDetails, type PluginLogger } from "./logging.ts";
import {
  getConfiguredOpenCodeToolName,
} from "./tool-names.ts";

const AGENT_HANDOFF_MARKER = "generate a prompt and call the task tool with subagent:";
const execFileAsync = promisify(execFile);

type ToolExecuteBeforeHook = NonNullable<Hooks["tool.execute.before"]>;
type ToolExecuteBeforeInput = Parameters<ToolExecuteBeforeHook>[0];
type ToolExecuteBeforeOutput = Parameters<ToolExecuteBeforeHook>[1];
type CommandExecuteBeforeHook = NonNullable<Hooks["command.execute.before"]>;
type CommandExecuteBeforeInput = Parameters<CommandExecuteBeforeHook>[0];
type CommandExecuteBeforeOutput = Parameters<CommandExecuteBeforeHook>[1];
type ChatMessageHook = NonNullable<Hooks["chat.message"]>;
type ChatMessageOutput = Parameters<ChatMessageHook>[1];
type OpenCodeToolCreator = (
  client: PluginInput["client"],
  config: MergedKompassConfig,
  projectRoot: string,
  shell: Shell,
) => ToolDefinition;

type ShellResult = ShellPromise & {
  stdout: Buffer;
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

export type TaskToolExecution = {
  prompt: string;
  raw_prompt?: string;
  description?: string;
  subagent_type?: string;
  command?: string;
};

export type CommandExecution = {
  command: string;
  arguments: string;
  prompt: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function logObservedFailure(
  logger: PluginLogger,
  message: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  logger.warn(message, {
    ...(extra ?? {}),
    ...getErrorDetails(error),
  });
}

export async function getTaskToolExecution(
  input: ToolExecuteBeforeInput,
  output: ToolExecuteBeforeOutput,
): Promise<TaskToolExecution | undefined> {
  if (input.tool !== "task") return;
  if (!output.args || typeof output.args !== "object") return;

  const args = output.args as Record<string, unknown>;
  const prompt = getString(args.prompt);
  const command = getString(args.command);

  if (!prompt && !command) return;

  return {
    prompt: prompt ?? command ?? "",
    raw_prompt: prompt,
    description: getString(args.description),
    subagent_type: getString(args.subagent_type),
    command,
  };
}

export function getCommandExecution(
  input: CommandExecuteBeforeInput,
  output: CommandExecuteBeforeOutput,
): CommandExecution | undefined {
  const prompt = output.parts
    .flatMap((part) => part.type === "text" ? [part.text] : [])
    .join("\n")
    .trim();

  if (!prompt) return;

  return {
    command: input.command,
    arguments: input.arguments,
    prompt,
  };
}

export function removeSyntheticAgentHandoff(output: ChatMessageOutput): boolean {
  const filteredParts = output.parts.filter((part) => !(
    part.type === "text" &&
    part.synthetic === true &&
    part.text.toLowerCase().includes(AGENT_HANDOFF_MARKER)
  ));

  if (filteredParts.length === output.parts.length) return false;

  output.parts.splice(0, output.parts.length, ...filteredParts);
  return true;
}

const opencodeToolCreators: Record<string, OpenCodeToolCreator> = {
  changes_load(_: PluginInput["client"], __: MergedKompassConfig, _projectRoot: string, shell: Shell) {
    const definition = createChangesLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        base: tool.schema.string().describe("Base branch or ref").optional(),
        head: tool.schema.string().describe("Head branch, commit, or ref override").optional(),
        depthHint: tool.schema.number().int().positive()
          .describe("Optional shallow-fetch hint, such as PR commit count")
          .optional(),
        uncommitted: tool.schema.boolean()
          .describe("Only load uncommitted changes (staged and unstaged), never fall back to branch comparison")
          .optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  command_expansion(_client: PluginInput["client"], config: MergedKompassConfig, projectRoot: string, _shell: Shell) {
    return tool({
      description: "Expand a delegated command body into a runnable prompt for immediate task execution.",
      args: {
        command: tool.schema.string().describe("Command name to execute, without the leading slash"),
        body: tool.schema.string().describe("Literal body content from the delegate block").optional(),
      },
      execute: async (args, context) => {
        const names = await loadConfiguredNames(projectRoot);
        const definition = createCommandExpansionTool(projectRoot, { names });

        context.metadata({
          title: `Command /${args.command.trim()}`,
          metadata: {
            command: args.command,
          },
        });

        return definition.execute(args, context);
      },
    });
  },
  pr_load(_: PluginInput["client"], __: MergedKompassConfig, _projectRoot: string, shell: Shell) {
    const definition = createPrLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        pr: tool.schema.string().describe("PR number or URL").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  pr_sync(_: PluginInput["client"], config: MergedKompassConfig, _projectRoot: string, shell: Shell) {
    const definition = createPrSyncTool(shell);

    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("PR title; required when creating or renaming a PR").optional(),
        body: tool.schema.string().describe("PR body override").optional(),
        description: tool.schema.string().describe("Short PR description rendered above checklist sections").optional(),
        base: tool.schema.string().describe("Base branch to merge into").optional(),
        head: tool.schema.string().describe("Head branch to use when creating a PR").optional(),
        assignees: tool.schema.array(tool.schema.string()).describe("Assignees to apply to the PR").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        draft: tool.schema.boolean().describe("Create as draft PR").optional(),
        refUrl: tool.schema.string().describe("Optional PR URL to update").optional(),
        commitId: tool.schema.string().describe("Commit SHA to anchor review comments to; omit unless sending review comments").optional(),
        review: tool.schema.object({
          body: tool.schema.string().describe("Optional review summary body").optional(),
          comments: tool.schema.array(tool.schema.object({
            path: tool.schema.string().describe("Changed file path"),
            body: tool.schema.string().describe("Inline review comment body"),
            line: tool.schema.number().int().describe("Ending line on the diff side"),
            startLine: tool.schema.number().int().describe("Starting line for multi-line comments").optional(),
            side: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the ending line").optional(),
            startSide: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the starting line").optional(),
          })).describe("Inline review comments to submit").optional(),
          ...(config.shared.prApprove
            ? { approve: tool.schema.boolean().describe("Approve the PR with this review comment").optional() }
            : {}
          ),
        }).describe("Optional structured review submission; omit the field entirely unless submitting a review body, inline comments, or approval").optional(),
        replies: tool.schema.array(tool.schema.object({
          inReplyTo: tool.schema.number().int().describe("Existing review comment ID to reply to"),
          body: tool.schema.string().describe("Reply body"),
        })).describe("Replies to existing review comments").optional(),
        commentBody: tool.schema.string().describe("General PR comment body").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_sync(_: PluginInput["client"], __: MergedKompassConfig, _projectRoot: string, shell: Shell) {
    const definition = createTicketSyncTool(shell);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("Issue title").optional(),
        body: tool.schema.string().describe("Issue body override").optional(),
        description: tool.schema.string().describe("Issue description rendered above checklist sections").optional(),
        labels: tool.schema.array(tool.schema.string()).describe("Labels to apply to the issue").optional(),
        assignees: tool.schema.array(tool.schema.string()).describe("Assignees to apply to the issue").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        refUrl: tool.schema.string().describe("Optional issue URL to update").optional(),
        comments: tool.schema.array(tool.schema.string()).describe("Optional issue comments to post").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_load(_: PluginInput["client"], __: MergedKompassConfig, _projectRoot: string, shell: Shell) {
    const definition = createTicketLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        source: tool.schema.string().describe("Issue URL, repo#id, #id, file path, or raw text"),
        comments: tool.schema.boolean().describe("Include issue comments").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
};

export async function createOpenCodeTools(
  client: PluginInput["client"],
  projectRoot: string,
): Promise<Record<string, ToolDefinition>> {
  const config = await loadMergedKompassConfig(projectRoot);
  const tools: Record<string, ToolDefinition> = {};
  const logger = createPluginLogger(client, projectRoot);
  const shell = createNodeShell(projectRoot);

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = opencodeToolCreators[toolName as keyof typeof opencodeToolCreators];
    if (creator) {
      const registeredName = getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name);
      tools[registeredName] = creator(client, config, projectRoot, shell);
      logger.info("Loaded Kompass tool", {
        tool: toolName,
        registeredName,
      });
    }
  }

  return tools;
}

export const OpenCodeCompassPlugin: Plugin = async (input: PluginInput) => {
  const { client, worktree } = input;
  const logger = createPluginLogger(client, worktree);

  logger.info("Initialized Kompass plugin", {
    directory: getString(input.directory),
    worktree: getString(worktree),
    projectPath: getString((input as { project?: { path?: string } }).project?.path),
  });

  async function createToolsSafely() {
    try {
      return await createOpenCodeTools(client, worktree);
    } catch (error) {
      logger.warn("Skipping Kompass tool registration", {
        ...getErrorDetails(error),
      });
      return {};
    }
  }

  async function runConfigStep(name: string, register: () => Promise<void>) {
    try {
      await register();
    } catch (error) {
      logger.warn("Skipping Kompass config registration step", {
        step: name,
        worktree,
        ...getErrorDetails(error),
      });
    }
  }

  const tools = await createToolsSafely();

  return {
    tool: tools,
    async config(cfg) {
      await runConfigStep("agents", () => applyAgentsConfig(cfg, worktree, { logger }));
      await runConfigStep("commands", () => applyCommandsConfig(cfg, worktree, { logger }));
    },
    async "chat.message"(input, output) {
      try {
        const removedSyntheticHandoff = removeSyntheticAgentHandoff(output);

        if (!removedSyntheticHandoff) return;

        logger.info("Removed synthetic agent handoff text", {
          sessionID: input.sessionID,
          messageID: input.messageID,
          agent: input.agent,
        });
      } catch (error) {
        logObservedFailure(logger, "chat.message hook failed", error, {
          sessionID: input.sessionID,
          messageID: input.messageID,
          agent: input.agent,
        });
      }
    },
    async "command.execute.before"(input, output) {
      try {
        const commandExecution = getCommandExecution(input, output);

        if (!commandExecution) return;

        logger.info("Executing Kompass command", commandExecution as Record<string, unknown>);
      } catch (error) {
        logObservedFailure(logger, "command.execute.before hook failed", error, {
          command: input.command,
          arguments: input.arguments,
          sessionID: input.sessionID,
        });
      }
    },
    async "tool.execute.before"(input, output) {
      try {
        const taskExecution = await getTaskToolExecution(input, output);

        if (!taskExecution) return;

        logger.info("Executing Kompass task tool", taskExecution as Record<string, unknown>);
      } catch (error) {
        logObservedFailure(logger, "tool.execute.before hook failed", error, {
          tool: input.tool,
          callID: input.callID,
          sessionID: input.sessionID,
        });
      }
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPlugin;
