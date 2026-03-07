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
      const dirtyWorktree = implicitWorkspaceMode
        ? await hasWorktreeChanges($, ctx.worktree)
        : false;

      const requestedBase = dirtyWorktree
        ? "HEAD"
        : await resolveBaseRef($, ctx.worktree, args.base);
      const baseRef = dirtyWorktree
        ? "HEAD"
        : await ensureGitRef($, ctx.worktree, requestedBase, {
            depthHint: args.depthHint,
          });
      const headRef = dirtyWorktree
        ? "HEAD"
        : args.head?.trim()
          ? await resolveHeadRef($, ctx.worktree, args.head, args.depthHint)
          : "HEAD";

      const files = dirtyWorktree
        ? await $`git diff --find-renames --find-copies --name-status HEAD`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : implicitWorkspaceMode
          ? await $`git diff --find-renames --find-copies --name-status ${baseRef}`
              .cwd(ctx.worktree)
              .quiet()
              .nothrow()
          : await $`git diff --find-renames --find-copies --name-status ${baseRef}...${headRef}`
              .cwd(ctx.worktree)
              .quiet()
              .nothrow();
      const log = dirtyWorktree
        ? undefined
        : await $`git log --format=%H%x09%s ${baseRef}..${headRef}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();
      if (files.exitCode !== 0) {
        throw new Error(
          files.stderr.toString() ||
            `Failed to diff ${dirtyWorktree ? "HEAD against working tree" : implicitWorkspaceMode ? `${baseRef} against working tree` : `${baseRef}...${headRef}`}`,
        );
      }

      const parsedFiles = parseNameStatus(files.text()).filter((file) => file.path);
      const mergedFiles = dirtyWorktree || implicitWorkspaceMode
        ? await mergeUntrackedFiles($, ctx.worktree, parsedFiles)
        : parsedFiles;
      const filesWithDiff = args.diff
        ? dirtyWorktree
          ? await loadWorktreeDiffs($, ctx.worktree, mergedFiles)
          : implicitWorkspaceMode
          ? await loadWorkspaceFileDiffs($, ctx.worktree, baseRef, mergedFiles)
          : await loadFileDiffs($, ctx.worktree, baseRef, headRef, mergedFiles)
        : mergedFiles.map((file) => serializeFile(file));
      const commits = dirtyWorktree || implicitWorkspaceMode || !log ? [] : parseCommitList(log.text());

      return stringifyJson({
        files: filesWithDiff,
        ...(commits.length > 0 ? { commits } : {}),
      });
    },
  });
}

async function hasWorktreeChanges($: Shell, cwd: string) {
  const tracked = await $`git diff --quiet HEAD --`.cwd(cwd).quiet().nothrow();
  if (tracked.exitCode !== 0) {
    return true;
  }

  const untracked = await $`git ls-files --others --exclude-standard`.cwd(cwd).quiet().nothrow();
  return nonEmptyLines(untracked.text()).length > 0;
}

async function loadFileDiffs(
  $: Shell,
  cwd: string,
  baseRef: string,
  headRef: string,
  files: ChangedFile[],
) {
  const enriched: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.status === "added") {
      enriched.push(
        serializeFile(file, {
        diffOmittedReason: "added file; read current file contents instead",
        }),
      );
      continue;
    }

    const paths = [file.previousPath, file.path].filter(Boolean) as string[];
    const proc = paths.length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix ${baseRef}...${headRef} -- ${paths[0]} ${paths[1]}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix ${baseRef}...${headRef} -- ${paths[0]}`
          .cwd(cwd)
          .quiet()
          .nothrow();

    if (proc.exitCode !== 0) {
      enriched.push(serializeFile(file));
      continue;
    }

    enriched.push(serializeFile(file, normalizeNativeDiff(file, proc.text())));
  }

  return enriched;
}

async function loadWorkspaceFileDiffs($: Shell, cwd: string, baseRef: string, files: ChangedFile[]) {
  const enriched: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.status === "added" || file.status === "untracked") {
      enriched.push(
        serializeFile(file, {
        diffOmittedReason:
          file.status === "added"
            ? "added file; read current file contents instead"
            : "untracked file; read current file contents instead",
        }),
      );
      continue;
    }

    const proc = [file.previousPath, file.path].filter(Boolean).length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix ${baseRef} -- ${file.previousPath!} ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix ${baseRef} -- ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow();

    if (proc.exitCode !== 0) {
      enriched.push(serializeFile(file));
      continue;
    }

    enriched.push(serializeFile(file, normalizeNativeDiff(file, proc.text())));
  }

  return enriched;
}

async function loadWorktreeDiffs($: Shell, cwd: string, files: ChangedFile[]) {
  const enriched: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.status === "added" || file.status === "untracked") {
      enriched.push(
        serializeFile(file, {
        diffOmittedReason:
          file.status === "added"
            ? "added file; read current file contents instead"
            : "untracked file; read current file contents instead",
        }),
      );
      continue;
    }

    const proc = [file.previousPath, file.path].filter(Boolean).length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix HEAD -- ${file.previousPath!} ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix HEAD -- ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow();

    if (proc.exitCode !== 0) {
      enriched.push(serializeFile(file));
      continue;
    }

    enriched.push(serializeFile(file, normalizeNativeDiff(file, proc.text())));
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

function serializeFile(
  file: ChangedFile,
  extras?: { diff?: string; diffOmittedReason?: string },
) {
  return {
    status: file.status,
    path: file.path,
    ...(file.previousPath ? { previousPath: file.previousPath } : {}),
    ...(typeof file.similarity === "number" ? { similarity: file.similarity } : {}),
    ...(extras?.diff ? { diff: extras.diff } : {}),
    ...(extras?.diffOmittedReason ? { diffOmittedReason: extras.diffOmittedReason } : {}),
  };
}

function normalizeNativeDiff(file: ChangedFile, rawDiff: string) {
  const diff = rawDiff
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("diff --git ") &&
        !line.startsWith("index ") &&
        !line.startsWith("--- ") &&
        !line.startsWith("+++ "),
    )
    .join("\n")
    .trim();

  if (diff) {
    return { diff };
  }

  if (file.status === "renamed" || file.status === "copied") {
    return { diffOmittedReason: "path-only change; inspect moved file contents directly" };
  }

  return undefined;
}

async function resolveHeadRef($: Shell, cwd: string, input: string, depthHint?: number) {
  const trimmed = input.trim();
  const direct = await $`git rev-parse --verify ${trimmed}`.cwd(cwd).quiet().nothrow();
  if (direct.exitCode === 0) {
    return trimmed;
  }

  return ensureGitRef($, cwd, trimmed, { depthHint });
}
