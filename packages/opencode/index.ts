import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

import {
  createChangesLoadTool,
  createPrLoadTool,
  createPrSyncTool,
  createTicketLoadTool,
  createTicketSyncTool,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  resolveCommands,
} from "../core/index.ts";
import { applyAgentsConfig, applyCommandsConfig, applySkillsConfig } from "./config.ts";
import { createPluginLogger, type PluginLogger } from "./logging.ts";
import {
  getConfiguredOpenCodeToolName,
  prefixKompassToolReferences,
} from "./tool-names.ts";

const AGENT_HANDOFF_MARKER = "generate a prompt and call the task tool with subagent:";

type ToolExecuteBeforeHook = NonNullable<Hooks["tool.execute.before"]>;
type ToolExecuteBeforeInput = Parameters<ToolExecuteBeforeHook>[0];
type ToolExecuteBeforeOutput = Parameters<ToolExecuteBeforeHook>[1];
type CommandExecuteBeforeHook = NonNullable<Hooks["command.execute.before"]>;
type CommandExecuteBeforeInput = Parameters<CommandExecuteBeforeHook>[0];
type CommandExecuteBeforeOutput = Parameters<CommandExecuteBeforeHook>[1];
type ChatMessageHook = NonNullable<Hooks["chat.message"]>;
type ChatMessageOutput = Parameters<ChatMessageHook>[1];

export type TaskToolExecution = {
  prompt: string;
  raw_prompt?: string;
  description?: string;
  subagent_type?: string;
  command?: string;
  command_name?: string;
  command_arguments?: string;
};

export type CommandExecution = {
  command: string;
  arguments: string;
  prompt: string;
};

type ParsedSlashCommand = {
  command: string;
  arguments: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseSlashCommand(value: string): ParsedSlashCommand | undefined {
  const match = value.trim().match(/^(?:@\S+\s+)?\/([^\s]+)(?:\s+([\s\S]*))?$/);

  if (!match) return;

  return {
    command: match[1],
    arguments: match[2]?.trim() ?? "",
  };
}

function expandCommandTemplate(template: string, commandArguments: string) {
  const trimmedArguments = commandArguments.trim();
  const positionalArguments = trimmedArguments ? trimmedArguments.split(/\s+/) : [];

  let expandedTemplate = template.replaceAll("$ARGUMENTS", trimmedArguments);

  for (const [index, argument] of positionalArguments.entries()) {
    expandedTemplate = expandedTemplate.replaceAll(`$${index + 1}`, argument);
  }

  return expandedTemplate;
}

export async function expandSlashCommandPrompt(
  projectRoot: string,
  value: string,
  logger?: PluginLogger,
): Promise<CommandExecution | undefined> {
  const parsedCommand = parseSlashCommand(value);

  if (!parsedCommand) return;

  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const commands = await resolveCommands(projectRoot);
  const definition = commands[parsedCommand.command];

  if (!definition) return;

  const configuredToolNames = Object.fromEntries(
    getEnabledToolNames(config.tools).map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const template = prefixKompassToolReferences(definition.template, configuredToolNames);
  const expandedPrompt = expandCommandTemplate(template, parsedCommand.arguments);

  if (logger) {
    await logger.info("Resolved slash command", {
      input: value,
      command: parsedCommand.command,
      arguments: parsedCommand.arguments,
      output: expandedPrompt,
    });
  }

  return {
    command: parsedCommand.command,
    arguments: parsedCommand.arguments,
    prompt: expandedPrompt,
  };
}

export async function getTaskToolExecution(
  input: ToolExecuteBeforeInput,
  output: ToolExecuteBeforeOutput,
  projectRoot: string,
  logger?: PluginLogger,
): Promise<TaskToolExecution | undefined> {
  if (input.tool !== "task") return;
  if (!output.args || typeof output.args !== "object") return;

  const args = output.args as Record<string, unknown>;
  const prompt = getString(args.prompt);
  const command = getString(args.command);

  if (!prompt && !command) return;

  const expandedCommand = command
    ? await expandSlashCommandPrompt(projectRoot, command, logger)
    : prompt
      ? await expandSlashCommandPrompt(projectRoot, prompt, logger)
      : undefined;
  const finalPrompt = expandedCommand?.prompt ?? prompt ?? command ?? "";

  args.prompt = finalPrompt;

  return {
    prompt: finalPrompt,
    raw_prompt: prompt,
    description: getString(args.description),
    subagent_type: getString(args.subagent_type),
    command,
    command_name: expandedCommand?.command,
    command_arguments: expandedCommand?.arguments,
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
    part.text.includes(AGENT_HANDOFF_MARKER)
  ));

  if (filteredParts.length === output.parts.length) return false;

  output.parts.splice(0, output.parts.length, ...filteredParts);
  return true;
}

function createReloadTool(client: PluginInput["client"]) {
  return tool({
    description: "Reload the current OpenCode project cache",
    args: {},
    async execute(_, context) {
      // Defer dispose so the tool returns before the session is torn down
      setTimeout(() => {
        void client.instance.dispose({ query: { directory: context.directory } });
      }, 500);
      return JSON.stringify({
        scope: "project",
        directory: context.directory,
        status: "reload-requested",
        nextLoad: "config, commands, agents, custom tools, and plugins rebuild on next access",
      }, null, 2);
    },
  });
}

const opencodeToolCreators = {
  changes_load($: PluginInput["$"]) {
    const definition = createChangesLoadTool($);
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
  pr_load($: PluginInput["$"]) {
    const definition = createPrLoadTool($);
    return tool({
      description: definition.description,
      args: {
        pr: tool.schema.string().describe("PR number or URL").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  pr_sync($: PluginInput["$"]) {
    const definition = createPrSyncTool($);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("PR title; required when creating or renaming a PR").optional(),
        body: tool.schema.string().describe("PR body override").optional(),
        description: tool.schema.string().describe("Short PR description rendered above checklist sections").optional(),
        base: tool.schema.string().describe("Base branch to merge into").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        draft: tool.schema.boolean().describe("Create as draft PR").optional(),
        refUrl: tool.schema.string().describe("Optional PR URL to update").optional(),
        approve: tool.schema.boolean().describe("Approve the referenced PR without posting a comment body").optional(),
        review: tool.schema.object({
          event: tool.schema.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]).describe("Review event to submit"),
          body: tool.schema.string().describe("Optional review summary body").optional(),
          commitId: tool.schema.string().describe("Commit SHA anchor for inline review comments").optional(),
          comments: tool.schema.array(tool.schema.object({
            path: tool.schema.string().describe("Changed file path"),
            body: tool.schema.string().describe("Inline review comment body"),
            line: tool.schema.number().int().positive().describe("Ending line on the diff side"),
            startLine: tool.schema.number().int().positive().describe("Starting line for multi-line comments").optional(),
            side: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the ending line").optional(),
            startSide: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the starting line").optional(),
          })).describe("Inline review comments to submit").optional(),
        }).describe("Structured review submission").optional(),
        replies: tool.schema.array(tool.schema.object({
          inReplyTo: tool.schema.number().int().positive().describe("Existing review comment ID to reply to"),
          body: tool.schema.string().describe("Reply body"),
        })).describe("Replies to existing review comments").optional(),
        commentBody: tool.schema.string().describe("General PR comment body").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_sync($: PluginInput["$"]) {
    const definition = createTicketSyncTool($);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("Issue title"),
        body: tool.schema.string().describe("Issue body override").optional(),
        description: tool.schema.string().describe("Issue description rendered above checklist sections").optional(),
        labels: tool.schema.array(tool.schema.string()).describe("Labels to apply to the issue").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        refUrl: tool.schema.string().describe("Optional issue URL to update").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_load($: PluginInput["$"]) {
    const definition = createTicketLoadTool($);
    return tool({
      description: definition.description,
      args: {
        source: tool.schema.string().describe("Issue URL, repo#id, #id, file path, or raw text"),
        comments: tool.schema.boolean().describe("Include issue comments").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  reload(_: PluginInput["$"], client: PluginInput["client"]) {
    return createReloadTool(client);
  },
} as const;

export async function createOpenCodeTools(
  $: PluginInput["$"],
  client: PluginInput["client"],
  projectRoot: string,
): Promise<Record<string, ToolDefinition>> {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const tools: Record<string, ToolDefinition> = {};
  const logger = createPluginLogger(client, projectRoot);

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = opencodeToolCreators[toolName as keyof typeof opencodeToolCreators];
    if (creator) {
      const registeredName = getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name);
      tools[registeredName] = creator($, client);
      await logger.info("Loaded Kompass tool", {
        tool: toolName,
        registeredName,
      });
    }
  }

  return tools;
}

export const OpenCodeCompassPlugin: Plugin = async ({ $, client, worktree }: PluginInput) => {
  const logger = createPluginLogger(client, worktree);

  return {
    tool: await createOpenCodeTools($, client, worktree),
    async config(cfg) {
      await applyAgentsConfig(cfg, worktree, { logger });
      await applyCommandsConfig(cfg, worktree, { logger });
      await applySkillsConfig(cfg, { logger });
    },
    async "chat.message"(input, output) {
      const removedSyntheticHandoff = removeSyntheticAgentHandoff(output);

      if (!removedSyntheticHandoff) return;

      await logger.info("Removed synthetic agent handoff text", {
        sessionID: input.sessionID,
        messageID: input.messageID,
        agent: input.agent,
      });
    },
    async "command.execute.before"(input, output) {
      const commandExecution = getCommandExecution(input, output);

      if (!commandExecution) return;

      await logger.info("Executing Kompass command", commandExecution as Record<string, unknown>);
    },
    async "tool.execute.before"(input, output) {
      const taskExecution = await getTaskToolExecution(input, output, worktree, logger);

      if (!taskExecution) return;

      await logger.info("Executing Kompass task tool", taskExecution as Record<string, unknown>);
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig, applySkillsConfig };
export default OpenCodeCompassPlugin;
