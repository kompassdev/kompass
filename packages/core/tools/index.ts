import {
  getConfiguredToolName,
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
} from "../lib/config.ts";
import { createChangesLoadTool } from "./changes-load.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createPrLoadReviewTool } from "./pr-load-review.ts";
import { createPrSyncTool } from "./pr-sync.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import { createTicketSyncTool } from "./ticket-sync.ts";
import type { Shell, ToolDefinition } from "./shared.ts";
import { TicketProviderName } from "./provider/interface.ts";

const toolCreators: Record<
  string,
  ($: Shell, projectRoot: string, provider: TicketProviderName) => ToolDefinition
> = {
  changes_load: ($) => createChangesLoadTool($),
  pr_load: ($) => createPrLoadTool($),
  pr_load_review: ($) => createPrLoadReviewTool($),
  pr_sync: ($) => createPrSyncTool($),
  ticket_sync: ($, _projectRoot, provider) => createTicketSyncTool($, provider),
  ticket_load: ($, _projectRoot, provider) => createTicketLoadTool($, provider),
};

export async function createTools($: Shell, projectRoot: string) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  const tools: Record<string, ToolDefinition> = {};

  for (const toolName of getEnabledToolNames(config.tools)) {
    const creator = toolCreators[toolName];
    if (creator) {
      tools[getConfiguredToolName(config.tools, toolName)] = creator($, projectRoot, config.tools.provider);
    }
  }

  return tools;
}
