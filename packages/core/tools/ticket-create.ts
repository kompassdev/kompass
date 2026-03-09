import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

export function createTicketCreateTool($: Shell) {
  return {
    description: "Create a GitHub issue",
    args: {
      title: { type: "string", description: "Issue title" },
      body: { type: "string", description: "Issue body" },
      repo: {
        type: "string",
        optional: true,
        description: "Optional owner/repo override",
      },
    },
    async execute(
      args: { title: string; body: string; repo?: string },
      ctx: ToolExecutionContext,
    ) {
      const proc = args.repo
        ? await $`gh issue create --repo ${args.repo} --title ${args.title} --body ${args.body}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : await $`gh issue create --title ${args.title} --body ${args.body}`
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
  } satisfies ToolDefinition<{
    title: string;
    body: string;
    repo?: string;
  }>;
}
