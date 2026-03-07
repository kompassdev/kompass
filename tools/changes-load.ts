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
      depthHint: tool.schema
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional shallow-fetch hint, such as PR commit count"),
      diff: tool.schema
        .boolean()
        .optional()
        .describe("Include structured per-file diffs"),
    },
    async execute(
      args: { base?: string; head?: string; depthHint?: number; diff?: boolean },
      ctx: PluginContext,
    ) {
      const implicitWorkspaceMode = !args.base?.trim() && !args.head?.trim();
      const requestedBase = await resolveBaseRef($, ctx.worktree, args.base);
      const baseRef = await ensureGitRef($, ctx.worktree, requestedBase, {
        depthHint: args.depthHint,
      });
      const headRef = args.head?.trim()
        ? await resolveHeadRef($, ctx.worktree, args.head, args.depthHint)
        : "HEAD";
      const branch = await $`git branch --show-current`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const status = await $`git status --short`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      const stat = implicitWorkspaceMode
        ? await $`git diff --stat ${baseRef}`.cwd(ctx.worktree).quiet().nothrow()
        : await $`git diff --stat ${baseRef}...${headRef}`.cwd(ctx.worktree).quiet().nothrow();
      const files = implicitWorkspaceMode
        ? await $`git diff --find-renames --find-copies --name-status ${baseRef}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : await $`git diff --find-renames --find-copies --name-status ${baseRef}...${headRef}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();
      const log = await $`git log --format=%H%x09%s ${baseRef}..${headRef}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();
      if (stat.exitCode !== 0) {
        throw new Error(
          stat.stderr.toString() ||
            `Failed to diff ${implicitWorkspaceMode ? `${baseRef} against working tree` : `${baseRef}...${headRef}`}`,
        );
      }

      const parsedFiles = parseNameStatus(files.text()).filter((file) => file.path);
      const mergedFiles = implicitWorkspaceMode
        ? await mergeUntrackedFiles($, ctx.worktree, parsedFiles)
        : parsedFiles;
      const filesWithDiff = args.diff
        ? implicitWorkspaceMode
          ? await loadWorkspaceFileDiffs($, ctx.worktree, baseRef, mergedFiles)
          : await loadFileDiffs($, ctx.worktree, baseRef, headRef, mergedFiles)
        : mergedFiles;
      const commits = parseCommitList(log.text());

      return stringifyJson({
        base: baseRef,
        head: headRef,
        branch: branch.text().trim(),
        status: nonEmptyLines(status.text()),
        stat: stat.text().trim(),
        files: filesWithDiff,
        commits,
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
  const enriched: Array<ChangedFile & { diff?: string; diffOmittedReason?: string }> = [];

  for (const file of files) {
    if (file.status === "added") {
      enriched.push({
        ...file,
        diffOmittedReason: "added file; read current file contents instead",
      });
      continue;
    }

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

async function loadWorkspaceFileDiffs($: Shell, cwd: string, baseRef: string, files: ChangedFile[]) {
  const enriched: Array<ChangedFile & { diff?: string; diffOmittedReason?: string }> = [];

  for (const file of files) {
    if (file.status === "added" || file.status === "untracked") {
      enriched.push({
        ...file,
        diffOmittedReason:
          file.status === "added"
            ? "added file; read current file contents instead"
            : "untracked file; read current file contents instead",
      });
      continue;
    }

    const proc = [file.previousPath, file.path].filter(Boolean).length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 ${baseRef} -- ${file.previousPath!} ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 ${baseRef} -- ${file.path}`
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

async function mergeUntrackedFiles($: Shell, cwd: string, files: ChangedFile[]) {
  const untrackedProc = await $`git ls-files --others --exclude-standard`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (untrackedProc.exitCode !== 0) {
    return files;
  }

  const merged = [...files];
  const seen = new Set(merged.map((file) => file.path));

  for (const filePath of nonEmptyLines(untrackedProc.text())) {
    if (seen.has(filePath)) {
      continue;
    }

    merged.push({
      rawStatus: "??",
      status: "untracked",
      path: filePath,
    });
    seen.add(filePath);
  }

  return merged;
}

async function resolveHeadRef($: Shell, cwd: string, input: string, depthHint?: number) {
  const trimmed = input.trim();
  const direct = await $`git rev-parse --verify ${trimmed}`.cwd(cwd).quiet().nothrow();
  if (direct.exitCode === 0) {
    return trimmed;
  }

  return ensureGitRef($, cwd, trimmed, { depthHint });
}
