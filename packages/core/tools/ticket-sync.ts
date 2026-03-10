import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

type TicketSyncArgs = {
  title: string;
  body: string;
  refUrl?: string;
};

export function createTicketSyncTool($: Shell) {
  return {
    description: "Create or update a GitHub issue",
    args: {
      title: { type: "string", description: "Issue title" },
      body: { type: "string", description: "Issue body" },
      refUrl: {
        type: "string",
        optional: true,
        description: "Optional issue URL to update instead of creating a new issue",
      },
    },
    async execute(args: TicketSyncArgs, ctx: ToolExecutionContext) {
      if (args.refUrl) {
        const proc = await $`gh issue edit ${args.refUrl} --title ${args.title} --body ${args.body}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to update issue");
        }

        return stringifyJson({
          url: args.refUrl,
        });
      }

      const proc = await $`gh issue create --title ${args.title} --body ${args.body}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to create issue");
      }

      return stringifyJson({
        url: proc.text().trim(),
      });
    },
  } satisfies ToolDefinition<TicketSyncArgs>;
}
