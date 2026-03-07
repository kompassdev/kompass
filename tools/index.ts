import { loadCompassConfig, mergeWithDefaults } from "../lib/config.ts";
import { createChangesLoadTool } from "./changes-load.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createReviewLoadTool } from "./review-load.ts";
import { createReviewSubmitTool } from "./review-submit.ts";
import { createTicketCreateTool } from "./ticket-create.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import type { Shell } from "./shared.ts";

const toolCreators: Record<string, ($: Shell) => unknown> = {
  changes_load: createChangesLoadTool,
  pr_load: createPrLoadTool,
  review_load: createReviewLoadTool,
  review_submit: createReviewSubmitTool,
  ticket_load: createTicketLoadTool,
  ticket_create: createTicketCreateTool,
};

export async function createTools($: Shell, projectRoot: string) {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  const tools: Record<string, unknown> = {};

  for (const toolName of config.tools.enabled) {
    const creator = toolCreators[toolName];
    if (creator) {
      tools[toolName] = creator($);
    }
  }

  return tools;
}
