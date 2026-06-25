import {
  getConfiguredToolName,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
} from "../lib/config.ts";
import { createChangesLoadTool } from "./changes-load.ts";
import { createCommandExpansionTool } from "./dispatch.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createPrSyncTool } from "./pr-sync.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import { createTicketSyncTool } from "./ticket-sync.ts";
import { createWorktreeLoadTool } from "./worktree-load.ts";
import type { Shell, ToolDefinition } from "./shared.ts";

const toolCreators: Record<string, ($: Shell, projectRoot: string) => ToolDefinition> = {
  changes_load: ($) => createChangesLoadTool($),
  command_expansion: (_, projectRoot) => createCommandExpansionTool(projectRoot),
  pr_load: ($) => createPrLoadTool($),
  pr_sync: ($) => createPrSyncTool($),
  ticket_sync: ($) => createTicketSyncTool($),
  ticket_load: ($) => createTicketLoadTool($),
  worktree_load: ($) => createWorktreeLoadTool($),
};

export async function createTools($: Shell, projectRoot: string) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  const tools: Record<string, ToolDefinition> = {};

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = toolCreators[toolName];
    if (creator) {
      tools[getConfiguredToolName(config.tools, toolName)] = creator($, projectRoot);
    }
  }

  return tools;
}
