import { tool } from "@opencode-ai/plugin/tool";

import { loadRepoName, stringifyJson, type PluginContext, type Shell } from "./shared.ts";

const prJsonKeys = [
  "number",
  "title",
  "body",
  "url",
  "state",
  "isDraft",
  "reviewDecision",
  "baseRefName",
  "headRefName",
  "author",
  "files",
  "commits",
].join(",");

export function createPrLoadTool($: Shell) {
  return tool({
    description: "Load a PR with optional reviews and diff",
    args: {
      pr: tool.schema.string().optional().describe("PR number or URL"),
      reviews: tool.schema
        .boolean()
        .optional()
        .describe("Include review summaries"),
      comments: tool.schema
        .boolean()
        .optional()
        .describe("Include review comments"),
      diff: tool.schema.boolean().optional().describe("Include the PR diff"),
    },
    async execute(
      args: { pr?: string; reviews?: boolean; comments?: boolean; diff?: boolean },
      ctx: PluginContext,
    ) {
      const proc = args.pr
        ? await $`gh pr view ${args.pr} --json ${prJsonKeys}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : await $`gh pr view --json ${prJsonKeys}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to load PR");
      }

      const info = JSON.parse(proc.text());
      const repo = await loadRepoName($, ctx.worktree);
      const reviews = args.reviews
        ? await $`gh api repos/${repo}/pulls/${info.number}/reviews`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : undefined;
      const comments = args.comments
        ? await $`gh api repos/${repo}/pulls/${info.number}/comments`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : undefined;
      const diff = args.diff
        ? args.pr
          ? await $`gh pr diff ${args.pr}`.cwd(ctx.worktree).quiet().nothrow()
          : await $`gh pr diff`.cwd(ctx.worktree).quiet().nothrow()
        : undefined;

      return stringifyJson({
        repo,
        pr: info,
        reviews: reviews?.exitCode === 0 ? JSON.parse(reviews.text()) : undefined,
        comments:
          comments?.exitCode === 0 ? JSON.parse(comments.text()) : undefined,
        diff: diff?.exitCode === 0 ? diff.text() : undefined,
      });
    },
  });
}
