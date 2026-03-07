import { tool } from "@opencode-ai/plugin";

import { stringifyJson, type PluginContext, type Shell } from "./shared.ts";

export function createTicketCreateTool($: Shell) {
  return tool({
    description: "Create a GitHub issue",
    args: {
      title: tool.schema.string().describe("Issue title"),
      body: tool.schema.string().describe("Issue body"),
      repo: tool.schema
        .string()
        .optional()
        .describe("Optional owner/repo override"),
    },
    async execute(
      args: { title: string; body: string; repo?: string },
      ctx: PluginContext,
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
  });
}
