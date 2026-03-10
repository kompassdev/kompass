import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

import {
  createChangesLoadTool,
  createPrLoadTool,
  createTicketLoadTool,
  createTicketSyncTool,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
} from "@kompassdev/core";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";

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
  ticket_sync($: PluginInput["$"]) {
    const definition = createTicketSyncTool($);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("Issue title"),
        body: tool.schema.string().describe("Issue body"),
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

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = opencodeToolCreators[toolName as keyof typeof opencodeToolCreators];
    if (creator) {
      tools[getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name)] = creator($, client);
    }
  }

  return tools;
}

export const OpenCodeCompassPlugin: Plugin = async ({ $, client, worktree }: PluginInput) => {
  return {
    tool: await createOpenCodeTools($, client, worktree),
    async config(cfg) {
      await applyAgentsConfig(cfg, worktree);
      await applyCommandsConfig(cfg, worktree);
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPlugin;
