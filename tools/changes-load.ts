import { tool } from "@opencode-ai/plugin/tool";

import {
  type ChangedFile,
  ensureGitRef,
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
      head: tool.schema.string().optional().describe("Head branch, commit, or ref override"),
      diff: tool.schema
        .boolean()
        .optional()
        .describe("Include structured per-file diffs"),
    },
    async execute(args: { base?: string; head?: string; diff?: boolean }, ctx: PluginContext) {
      const requestedBase = await resolveBaseRef($, ctx.worktree, args.base);
      const baseRef = await ensureGitRef($, ctx.worktree, requestedBase);
      const headRef = args.head?.trim()
        ? await resolveHeadRef($, ctx.worktree, args.head)
        : "HEAD";
      const range = `${baseRef}...${headRef}`;
      const branch = await $`git branch --show-current`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const status = await $`git status --short`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const stat = await $`git diff --stat ${range}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const files = await $`git diff --find-renames --find-copies --name-status ${range}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const log = await $`git log --format=%H%x09%s ${baseRef}..${headRef}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      if (stat.exitCode !== 0) {
        throw new Error(stat.stderr.toString() || `Failed to diff ${range}`);
      }

      const parsedFiles = parseNameStatus(files.text()).filter((file) => file.path);
      const filesWithDiff = args.diff
        ? await loadFileDiffs($, ctx.worktree, baseRef, headRef, parsedFiles)
        : parsedFiles;

      return stringifyJson({
        base: baseRef,
        head: headRef,
        range,
        branch: branch.text().trim(),
        worktree: ctx.worktree,
        status: nonEmptyLines(status.text()),
        stat: stat.text().trim(),
        files: filesWithDiff,
        commits: parseCommitList(log.text()),
      });
    },
  });
}

async function loadFileDiffs(
  $: Shell,
  cwd: string,
  baseRef: string,
  headRef: string,
  files: ChangedFile[],
) {
  const enriched: Array<ChangedFile & { diff?: string }> = [];

  for (const file of files) {
    const paths = [file.previousPath, file.path].filter(Boolean) as string[];
    const proc = paths.length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 ${baseRef}...${headRef} -- ${paths[0]} ${paths[1]}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 ${baseRef}...${headRef} -- ${paths[0]}`
          .cwd(cwd)
          .quiet()
          .nothrow();

    if (proc.exitCode !== 0) {
      enriched.push(file);
      continue;
    }

    enriched.push({
      ...file,
      diff: proc.text(),
    });
  }

  return enriched;
}

async function resolveHeadRef($: Shell, cwd: string, input: string) {
  const trimmed = input.trim();
  const direct = await $`git rev-parse --verify ${trimmed}`.cwd(cwd).quiet().nothrow();
  if (direct.exitCode === 0) {
    return trimmed;
  }

  return ensureGitRef($, cwd, trimmed);
}
