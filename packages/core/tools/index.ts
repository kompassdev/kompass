import { loadCompassConfig, mergeWithDefaults } from "../lib/config.ts";
import { createChangesLoadTool } from "./changes-load.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createTicketCreateTool } from "./ticket-create.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import type { Shell, ToolDefinition } from "./shared.ts";

const toolCreators: Record<string, ($: Shell) => ToolDefinition> = {
  changes_load: createChangesLoadTool,
  pr_load: createPrLoadTool,
  ticket_create: createTicketCreateTool,
  ticket_load: createTicketLoadTool,
};

export async function createTools($: Shell, projectRoot: string) {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  const tools: Record<string, ToolDefinition> = {};

  for (const toolName of config.tools.enabled) {
    const creator = toolCreators[toolName];
    if (creator) {
      tools[toolName] = creator($);
    }
  }

  return tools;
}
