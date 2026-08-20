import type { Shell, ToolDefinition, ToolExecutionContext } from "./shared.ts";
import { createTicketProviderChain } from "./provider/factory.ts";
import { TicketProviderName, type TicketSyncArgs } from "./provider/interface.ts";

export function createTicketSyncTool($: Shell, provider: TicketProviderName = TicketProviderName.GitHub) {
  const chain = createTicketProviderChain($, provider);

  return {
    description:
      provider === TicketProviderName.Jira ? "Create or update a Jira issue" : "Create or update a GitHub issue",
    args: {
      title: { type: "string", optional: true, description: "Issue title" },
      body: {
        type: "string",
        optional: true,
        description: "Issue body override; optional when using description/checklists",
      },
      description: {
        type: "string",
        optional: true,
        description: "Short issue description rendered above checklist sections",
      },
      labels: {
        type: "string[]",
        optional: true,
        description: "Labels to apply to the issue",
      },
      assignees: {
        type: "string[]",
        optional: true,
        description: "Assignees to apply to the issue",
      },
      checklists: {
        type: "json",
        optional: true,
        description: "Checklist sections rendered as markdown checklists",
      },
      refUrl: {
        type: "string",
        optional: true,
        description: "Optional issue URL to update instead of creating a new issue",
      },
      comments: {
        type: "string[]",
        optional: true,
        description: "Optional issue comments to post",
      },
      projectKey: {
        type: "string",
        optional: true,
        description: "Jira project key for issue creation",
      },
    },
    execute(args: TicketSyncArgs, context: ToolExecutionContext) {
      return chain.sync(args, context);
    },
  } satisfies ToolDefinition<TicketSyncArgs>;
}
