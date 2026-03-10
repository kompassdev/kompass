import {
  getConfiguredToolName,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
} from "../lib/config.ts";
import { createChangesLoadTool } from "./changes-load.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import { createTicketSyncTool } from "./ticket-sync.ts";
import type { Shell, ToolDefinition } from "./shared.ts";

const toolCreators: Record<string, ($: Shell) => ToolDefinition> = {
  changes_load: createChangesLoadTool,
  pr_load: createPrLoadTool,
  ticket_sync: createTicketSyncTool,
  ticket_load: createTicketLoadTool,
};

export async function createTools($: Shell, projectRoot: string) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  const tools: Record<string, ToolDefinition> = {};

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = toolCreators[toolName];
    if (creator) {
      tools[getConfiguredToolName(config.tools, toolName)] = creator($);
    }
  }

  return tools;
}
