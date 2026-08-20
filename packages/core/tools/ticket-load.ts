import type { Shell, ToolDefinition, ToolExecutionContext } from "./shared.ts";
import { createTicketProviderChain } from "./provider/factory.ts";
import { TicketProviderName, type TicketLoadArgs } from "./provider/interface.ts";

export function createTicketLoadTool($: Shell, provider: TicketProviderName = TicketProviderName.GitHub) {
  const chain = createTicketProviderChain($, provider);
  return {
    description:
      provider === TicketProviderName.Jira ? "Load a Jira ticket by URL or key" : "Load a ticket from GitHub, file, or text",
    args: {
      source: {
        type: "string",
        description:
          provider === TicketProviderName.Jira ? "Jira issue URL or key" : "Issue URL, repo#id, #id, file path, or raw text",
      },
      comments: {
        type: "boolean",
        optional: true,
        description: "Include issue comments",
      },
    },
    async execute(args: TicketLoadArgs, ctx: ToolExecutionContext) {
      return chain.load(args, ctx);
    },
  } satisfies ToolDefinition<TicketLoadArgs>;
}
