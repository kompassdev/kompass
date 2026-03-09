import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

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
    },
    async execute(
      args: { base?: string; head?: string; depthHint?: number },
      ctx: PluginContext,
    ) {
      const branch = await loadCurrentBranch($, ctx.worktree);
      const implicitWorkspaceMode = !args.base?.trim() && !args.head?.trim();
      if (implicitWorkspaceMode && (await hasWorktreeChanges($, ctx.worktree))) {
        const filesWithDiff = await withTemporaryIndex($, ctx.worktree, async (indexPath) => {
          const files = await loadTemporaryIndexFiles($, ctx.worktree, indexPath);
          return await loadTemporaryIndexDiffs($, ctx.worktree, indexPath, files);
        });

        return stringifyJson({
          comparison: "uncommitted",
          ...(branch ? { branch } : {}),
          files: filesWithDiff,
        });
      }

      const requestedBase = await resolveBaseRef($, ctx.worktree, args.base);
      const baseRef = await ensureGitRef($, ctx.worktree, requestedBase, {
        depthHint: args.depthHint,
      });
      const headRef = args.head?.trim()
        ? await resolveHeadRef($, ctx.worktree, args.head, args.depthHint)
        : "HEAD";

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
      if (files.exitCode !== 0) {
        throw new Error(
          files.stderr.toString() ||
            `Failed to diff ${implicitWorkspaceMode ? `${baseRef} against working tree` : `${baseRef}...${headRef}`}`,
        );
      }

      const parsedFiles = parseNameStatus(files.text()).filter((file) => file.path);
      const filesWithDiff = implicitWorkspaceMode
        ? await loadWorkspaceFileDiffs($, ctx.worktree, baseRef, parsedFiles)
        : await loadFileDiffs($, ctx.worktree, baseRef, headRef, parsedFiles);
      const commits = implicitWorkspaceMode ? [] : parseCommitList(log.text());

      return stringifyJson({
        comparison: `${baseRef}...${headRef}`,
        ...(branch ? { branch } : {}),
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

async function loadCurrentBranch($: Shell, cwd: string) {
  const proc = await $`git symbolic-ref --quiet --short HEAD`.cwd(cwd).quiet().nothrow();
  if (proc.exitCode !== 0) {
    return undefined;
  }

  const branch = proc.text().trim();
  return branch || undefined;
}

async function withTemporaryIndex<T>(
  $: Shell,
  cwd: string,
  operation: (indexPath: string) => Promise<T>,
) {
  const gitDirProc = await $`git rev-parse --git-dir`.cwd(cwd).quiet().nothrow();
  if (gitDirProc.exitCode !== 0) {
    throw new Error(gitDirProc.stderr.toString() || "Failed to resolve .git directory");
  }

  const gitDir = path.resolve(cwd, gitDirProc.text().trim());
  const tempDir = await mkdtemp(path.join(gitDir, "opencode-compass-index-"));
  const indexPath = path.join(tempDir, "index");

  try {
    const readTree = await $`env GIT_INDEX_FILE=${indexPath} git read-tree HEAD`
      .cwd(cwd)
      .quiet()
      .nothrow();
    if (readTree.exitCode !== 0) {
      throw new Error(readTree.stderr.toString() || "Failed to initialize temporary index");
    }

    const addAll = await $`env GIT_INDEX_FILE=${indexPath} git add -A -- .`
      .cwd(cwd)
      .quiet()
      .nothrow();
    if (addAll.exitCode !== 0) {
      throw new Error(addAll.stderr.toString() || "Failed to stage worktree in temporary index");
    }

    return await operation(indexPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function loadTemporaryIndexFiles($: Shell, cwd: string, indexPath: string) {
  const proc = await $`env GIT_INDEX_FILE=${indexPath} git diff --cached --find-renames --find-copies --name-status`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to load temporary index changes");
  }

  return parseNameStatus(proc.text()).filter((file) => file.path);
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

async function loadTemporaryIndexDiffs($: Shell, cwd: string, indexPath: string, files: ChangedFile[]) {
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
      ? await $`env GIT_INDEX_FILE=${indexPath} git diff --cached --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix -- ${file.previousPath!} ${file.path}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`env GIT_INDEX_FILE=${indexPath} git diff --cached --find-renames --find-copies --unified=3 --no-color --no-ext-diff --no-prefix -- ${file.path}`
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
  const binaryLine = rawDiff
    .split("\n")
    .find((line) => line.startsWith("Binary files ") || line.startsWith("GIT binary patch"));
  if (binaryLine) {
    return { diffOmittedReason: "binary change; inspect file contents or metadata directly" };
  }

  const diff = rawDiff
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("diff --git ") &&
        !line.startsWith("index ") &&
        !line.startsWith("old mode ") &&
        !line.startsWith("new mode ") &&
        !line.startsWith("deleted file mode ") &&
        !line.startsWith("new file mode ") &&
        !line.startsWith("similarity index ") &&
        !line.startsWith("rename from ") &&
        !line.startsWith("rename to ") &&
        !line.startsWith("copy from ") &&
        !line.startsWith("copy to ") &&
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
