import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

import {
  createChangesLoadTool,
  createPrLoadTool,
  createPrReviewTool,
  createTicketLoadTool,
  createTicketSyncTool,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
} from "../core/index.ts";
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
  pr_review($: PluginInput["$"]) {
    const definition = createPrReviewTool($);
    return tool({
      description: definition.description,
      args: {
        pr: tool.schema.string().describe("PR number or URL (optional, uses current PR if not provided)").optional(),
        comment_type: tool.schema.enum(["general", "inline", "reply"]).describe("Type of comment to add"),
        body: tool.schema.string().describe("Comment text"),
        commit_id: tool.schema.string().describe("Commit SHA for inline comments").optional(),
        path: tool.schema.string().describe("File path for inline comments").optional(),
        line: tool.schema.number().int().positive().describe("Line number for inline comments").optional(),
        in_reply_to: tool.schema.number().int().positive().describe("Comment ID to reply to").optional(),
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
