import { tool } from "@opencode-ai/plugin";

import {
  nonEmptyLines,
  parseCommitList,
  parseNameStatus,
  resolveBaseRef,
  stringifyJson,
  type PluginContext,
  type Shell,
} from "./shared.ts";

export function createChangesLoadTool($: Shell) {
  return tool({
    description: "Load branch changes against a base branch",
    args: {
      base: tool.schema.string().optional().describe("Base branch or ref"),
      diff: tool.schema
        .boolean()
        .optional()
        .describe("Include the full diff"),
    },
    async execute(args: { base?: string; diff?: boolean }, ctx: PluginContext) {
      const ref = await resolveBaseRef($, ctx.worktree, args.base);
      const branch = await $`git branch --show-current`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const status = await $`git status --short`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const stat = await $`git diff --stat ${ref}...HEAD`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const files = await $`git diff --name-status ${ref}...HEAD`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const log = await $`git log --format=%H%x09%s ${ref}..HEAD`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const diff = args.diff
        ? await $`git diff ${ref}...HEAD`.cwd(ctx.worktree).quiet().nothrow()
        : undefined;

      if (stat.exitCode !== 0) {
        throw new Error(stat.stderr.toString() || `Failed to diff against ${ref}`);
      }

      return stringifyJson({
        base: ref,
        branch: branch.text().trim(),
        worktree: ctx.worktree,
        status: nonEmptyLines(status.text()),
        stat: stat.text().trim(),
        files: parseNameStatus(files.text()),
        commits: parseCommitList(log.text()),
        diff: diff?.text(),
      });
    },
  });
}
