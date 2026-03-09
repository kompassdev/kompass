import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

import {
  createChangesLoadTool,
  createPrLoadTool,
  createTicketCreateTool,
  createTicketLoadTool,
  loadKompassConfig,
  mergeWithDefaults,
} from "@kompassdev/core";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";

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
  ticket_create($: PluginInput["$"]) {
    const definition = createTicketCreateTool($);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("Issue title"),
        body: tool.schema.string().describe("Issue body"),
        repo: tool.schema.string().describe("Optional owner/repo override").optional(),
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
} as const;

export async function createOpenCodeTools(
  $: PluginInput["$"],
  projectRoot: string,
): Promise<Record<string, ToolDefinition>> {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const tools: Record<string, ToolDefinition> = {};

  for (const toolName of config.tools.enabled) {
    const creator = opencodeToolCreators[toolName as keyof typeof opencodeToolCreators];
    if (creator) {
      tools[toolName] = creator($);
    }
  }

  return tools;
}

export const OpenCodeCompassPlugin: Plugin = async ({ $, worktree }: PluginInput) => {
  return {
    tool: await createOpenCodeTools($, worktree),
    async config(cfg) {
      await applyAgentsConfig(cfg, worktree);
      await applyCommandsConfig(cfg, worktree);
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPlugin;
