import path from "node:path";
import { readFile } from "node:fs/promises";

import { tool } from "@opencode-ai/plugin/tool";

import {
  loadRepoName,
  nonEmptyLines,
  parseCommitList,
  parseIssueReference,
  resolveBaseRef,
  stringifyJson,
  type PluginContext,
  type Shell,
} from "./shared.ts";

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
  "headRefOid",
  "author",
  "files",
  "commits",
].join(",");

const issueJsonKeys = [
  "number",
  "title",
  "body",
  "url",
  "state",
  "labels",
  "assignees",
  "author",
].join(",");

const DEFAULT_MAX_FILES = 60;
const DEFAULT_MAX_TOTAL_BYTES = 120_000;
const DEFAULT_MAX_DIFF_LINES = 220;
const DEFAULT_MAX_CONTENT_LINES = 800;
const DEFAULT_MAX_DIFF_BYTES = 16_000;
const DEFAULT_MAX_CONTENT_BYTES = 20_000;

const PROBABLE_BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".class",
  ".dll",
  ".dylib",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".lockb",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".ttf",
  ".war",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const PROBABLE_GENERATED_PATTERNS = [
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^vendor\//,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.ya?ml$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)composer\.lock$/,
  /(^|\/)Podfile\.lock$/,
  /(^|\/)go\.sum$/,
  /(^|\/)dist-ssr\//,
  /\.min\.(js|css)$/,
  /\.map$/,
];

type ReviewMode = "branch" | "pr";
type ComparisonTarget = { kind: "worktree" } | { kind: "commit"; ref: string };
type ReviewFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type_changed"
  | "unmerged"
  | "unknown"
  | "untracked";

type ChangedFile = {
  rawStatus: string;
  status: ReviewFileStatus;
  path: string;
  previousPath?: string;
  similarity?: number;
};

type TextSnapshot = {
  path: string;
  lineCount: number;
  byteCount: number;
  truncated: boolean;
  text?: string;
  omittedReason?: string;
};

type TrimmedText = {
  text?: string;
  lineCount: number;
  byteCount: number;
  truncated: boolean;
  omittedReason?: string;
};

function normalizeStatus(code: string): ReviewFileStatus {
  if (code === "??") return "untracked";

  switch (code[0]) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    case "U":
      return "unmerged";
    default:
      return "unknown";
  }
}

function parseDetailedNameStatus(text: string): ChangedFile[] {
  return nonEmptyLines(text).map((line) => {
    const [rawStatus, ...parts] = line.split("\t");
    const status = normalizeStatus(rawStatus);
    const similarity = Number.parseInt(rawStatus.slice(1), 10);

    if ((status === "renamed" || status === "copied") && parts.length >= 2) {
      return {
        rawStatus,
        status,
        previousPath: parts[0],
        path: parts[1],
        similarity: Number.isNaN(similarity) ? undefined : similarity,
      };
    }

    return {
      rawStatus,
      status,
      path: parts[0] || "",
      similarity: Number.isNaN(similarity) ? undefined : similarity,
    };
  });
}

function simplifyPullRequest(info: any) {
  return {
    number: info.number,
    title: info.title,
    body: info.body,
    url: info.url,
    state: info.state,
    isDraft: info.isDraft,
    reviewDecision: info.reviewDecision,
    baseRefName: info.baseRefName,
    headRefName: info.headRefName,
    headRefOid: info.headRefOid,
    author: info.author?.login ?? info.author?.name ?? info.author,
    files: Array.isArray(info.files)
      ? info.files.map((file: any) => ({
          path: file.path,
          additions: file.additions,
          deletions: file.deletions,
        }))
      : [],
    commits: Array.isArray(info.commits)
      ? info.commits.map((commit: any) => ({
          oid: commit.oid,
          messageHeadline:
            commit.messageHeadline ??
            (typeof commit.message === "string" ? commit.message.split("\n")[0] : undefined),
          authoredDate: commit.authoredDate,
          authors: Array.isArray(commit.authors)
            ? commit.authors
                .map((author: any) => author.login ?? author.name)
                .filter(Boolean)
            : undefined,
        }))
      : [],
  };
}

function simplifyReviews(reviews: any[]) {
  return reviews.map((review) => ({
    id: review.id,
    state: review.state,
    author: review.user?.login,
    body: review.body,
    submittedAt: review.submitted_at,
    commitId: review.commit_id,
  }));
}

function simplifyComments(comments: any[]) {
  return comments.map((comment) => ({
    id: comment.id,
    path: comment.path,
    line: comment.line,
    side: comment.side,
    startLine: comment.start_line,
    startSide: comment.start_side,
    author: comment.user?.login,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    body: comment.body,
    url: comment.html_url,
  }));
}

function extractIssueReferences(text: string) {
  if (!text.trim()) return [];

  const candidates = new Set<string>();
  const patterns = [
    /https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+(?:[/?#][^\s)]*)?/g,
    /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+/g,
    /(^|\s)#\d+/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      const candidate = match.trim();
      const normalized = candidate.startsWith("#") ? candidate : candidate.replace(/^\s+/, "");
      if (parseIssueReference(normalized)) {
        candidates.add(normalized);
      }
    }
  }

  return [...candidates];
}

function isProbableGenerated(filePath: string) {
  return PROBABLE_GENERATED_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isProbableBinary(filePath: string, text: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (PROBABLE_BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  return text.includes("\u0000");
}

function trimText(
  text: string,
  maxLines: number,
  maxBytes: number,
  omittedReason?: string,
): TrimmedText {
  const byteCount = Buffer.byteLength(text, "utf8");
  const lines = text.split("\n");
  const overBudget = lines.length > maxLines || byteCount > maxBytes;

  if (!overBudget) {
    return {
      text,
      lineCount: lines.length,
      byteCount,
      truncated: false,
    };
  }

  let currentBytes = 0;
  const trimmed: string[] = [];

  for (const line of lines.slice(0, maxLines)) {
    const lineBytes = Buffer.byteLength(`${line}\n`, "utf8");
    if (currentBytes + lineBytes > maxBytes) {
      break;
    }
    trimmed.push(line);
    currentBytes += lineBytes;
  }

  return {
    text: trimmed.join("\n"),
    lineCount: lines.length,
    byteCount,
    truncated: true,
    omittedReason: omittedReason ?? `truncated to ${maxLines} lines / ${maxBytes} bytes`,
  };
}

async function fileExists($: Shell, cwd: string, ref: string) {
  const proc = await $`git rev-parse --verify ${ref}`.cwd(cwd).quiet().nothrow();
  return proc.exitCode === 0;
}

async function resolvePreferredBaseRef($: Shell, cwd: string, requested?: string) {
  if (!requested?.trim()) {
    return resolveBaseRef($, cwd);
  }

  const direct = requested.trim();
  const candidates = direct.startsWith("origin/") ? [direct] : [`origin/${direct}`, direct];

  for (const candidate of candidates) {
    if (await fileExists($, cwd, candidate)) {
      return candidate;
    }
  }

  return direct;
}

async function resolveMergeBase($: Shell, cwd: string, baseRef: string, headRef?: string) {
  const proc = headRef
    ? await $`git merge-base ${baseRef} ${headRef}`.cwd(cwd).quiet().nothrow()
    : await $`git merge-base ${baseRef} HEAD`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode === 0) {
    return proc.text().trim();
  }

  return baseRef;
}

async function loadPullRequest($: Shell, cwd: string, pr?: string) {
  const proc = pr
    ? await $`gh pr view ${pr} --json ${prJsonKeys}`.cwd(cwd).quiet().nothrow()
    : await $`gh pr view --json ${prJsonKeys}`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to load PR");
  }

  return JSON.parse(proc.text());
}

async function loadIssue(
  $: Shell,
  cwd: string,
  worktree: string,
  source: string,
  includeComments: boolean,
) {
  const issue = parseIssueReference(source.trim());
  if (!issue) {
    return undefined;
  }

  const repo = issue.repo ?? (await loadRepoName($, worktree));
  const proc = await $`gh issue view ${issue.number} --repo ${repo} --json ${issueJsonKeys}`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    return {
      source,
      error: proc.stderr.toString() || "Failed to load linked ticket",
    };
  }

  const info = JSON.parse(proc.text());
  const comments = includeComments
    ? await $`gh issue view ${issue.number} --repo ${repo} --comments --json comments`
        .cwd(cwd)
        .quiet()
        .nothrow()
    : undefined;

  return {
    source,
    repo,
    issue: {
      number: info.number,
      title: info.title,
      body: info.body,
      url: info.url,
      state: info.state,
      labels: Array.isArray(info.labels) ? info.labels.map((label: any) => label.name) : [],
      assignees: Array.isArray(info.assignees)
        ? info.assignees.map((assignee: any) => assignee.login)
        : [],
      author: info.author?.login,
    },
    comments:
      comments?.exitCode === 0
        ? JSON.parse(comments.text()).comments.map((comment: any) => ({
            author: comment.author?.login,
            body: comment.body,
            createdAt: comment.createdAt,
          }))
        : undefined,
  };
}

async function resolveComparisonTarget(
  $: Shell,
  cwd: string,
  mode: ReviewMode,
  headRef?: string,
): Promise<ComparisonTarget> {
  if (mode === "pr" && headRef?.trim()) {
    const refish = `${headRef.trim()}^{commit}`;
    const proc = await $`git rev-parse --verify ${refish}`.cwd(cwd).quiet().nothrow();
    if (proc.exitCode === 0) {
      return { kind: "commit", ref: headRef.trim() };
    }
  }

  return { kind: "worktree" };
}

async function loadBranchName($: Shell, cwd: string) {
  const branch = await $`git branch --show-current`.cwd(cwd).quiet().nothrow();
  return branch.text().trim();
}

async function loadTrackedFiles(
  $: Shell,
  cwd: string,
  mergeBase: string,
  target: ComparisonTarget,
) {
  const proc = target.kind === "commit"
    ? await $`git diff --find-renames --find-copies --name-status ${mergeBase} ${target.ref}`
        .cwd(cwd)
        .quiet()
        .nothrow()
    : await $`git diff --find-renames --find-copies --name-status ${mergeBase}`
        .cwd(cwd)
        .quiet()
        .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to load changed files");
  }

  return parseDetailedNameStatus(proc.text()).filter((file) => file.path);
}

async function loadUntrackedFiles($: Shell, cwd: string) {
  const proc = await $`git ls-files --others --exclude-standard`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode !== 0) {
    return [];
  }

  return nonEmptyLines(proc.text()).map((filePath) => ({
    rawStatus: "??",
    status: "untracked" as const,
    path: filePath,
  }));
}

async function loadPerFileDiff(
  $: Shell,
  cwd: string,
  mergeBase: string,
  target: ComparisonTarget,
  file: ChangedFile,
  maxLines: number,
  maxBytes: number,
): Promise<TrimmedText> {
  const paths = [file.previousPath, file.path].filter(Boolean) as string[];
  const proc = target.kind === "commit"
    ? paths.length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 ${mergeBase} ${target.ref} -- ${paths[0]} ${paths[1]}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 ${mergeBase} ${target.ref} -- ${paths[0]}`
          .cwd(cwd)
          .quiet()
          .nothrow()
    : paths.length > 1
      ? await $`git diff --find-renames --find-copies --unified=3 ${mergeBase} -- ${paths[0]} ${paths[1]}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`git diff --find-renames --find-copies --unified=3 ${mergeBase} -- ${paths[0]}`
          .cwd(cwd)
          .quiet()
          .nothrow();

  if (proc.exitCode !== 0) {
    return {
      text: undefined,
      lineCount: 0,
      byteCount: 0,
      omittedReason: proc.stderr.toString() || "Failed to load diff",
      truncated: false,
    };
  }

  return trimText(proc.text(), maxLines, maxBytes, `diff truncated to ${maxLines} lines / ${maxBytes} bytes`);
}

async function loadSnapshotFromWorktree(
  worktree: string,
  filePath: string,
  maxLines: number,
  maxBytes: number,
): Promise<TextSnapshot | undefined> {
  const absolutePath = path.resolve(worktree, filePath);
  let buffer: Buffer;

  try {
    buffer = await readFile(absolutePath);
  } catch {
    return undefined;
  }

  const text = buffer.toString("utf8");

  if (isProbableBinary(filePath, text)) {
    return {
      path: filePath,
      lineCount: 0,
      byteCount: buffer.byteLength,
      truncated: false,
      omittedReason: "binary file",
    };
  }

  const trimmed = trimText(text, maxLines, maxBytes);
  return {
    path: filePath,
    lineCount: trimmed.lineCount,
    byteCount: trimmed.byteCount,
    truncated: trimmed.truncated,
    text: trimmed.text,
    omittedReason: trimmed.omittedReason,
  };
}

async function loadSnapshotFromGit(
  $: Shell,
  cwd: string,
  ref: string,
  filePath: string,
  maxLines: number,
  maxBytes: number,
): Promise<TextSnapshot | undefined> {
  const refPath = `${ref}:${filePath}`;
  const proc = await $`git show ${refPath}`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode !== 0) {
    return undefined;
  }

  const text = proc.text();
  if (isProbableBinary(filePath, text)) {
    return {
      path: filePath,
      lineCount: 0,
      byteCount: Buffer.byteLength(text, "utf8"),
      truncated: false,
      omittedReason: "binary file",
    };
  }

  const trimmed = trimText(text, maxLines, maxBytes);
  return {
    path: filePath,
    lineCount: trimmed.lineCount,
    byteCount: trimmed.byteCount,
    truncated: trimmed.truncated,
    text: trimmed.text,
    omittedReason: trimmed.omittedReason,
  };
}

async function loadCurrentSnapshot(
  $: Shell,
  ctx: PluginContext,
  target: ComparisonTarget,
  filePath: string,
  maxLines: number,
  maxBytes: number,
) {
  if (target.kind === "commit") {
    return loadSnapshotFromGit($, ctx.worktree, target.ref, filePath, maxLines, maxBytes);
  }

  return loadSnapshotFromWorktree(ctx.worktree, filePath, maxLines, maxBytes);
}

async function buildReviewFile(
  $: Shell,
  ctx: PluginContext,
  file: ChangedFile,
  mergeBase: string,
  target: ComparisonTarget,
  budget: { remainingBytes: number },
  limits: {
    maxDiffLines: number;
    maxDiffBytes: number;
    maxContentLines: number;
    maxContentBytes: number;
  },
  includeDetails: boolean,
) {
  const generatedLikely = isProbableGenerated(file.path);
  const result: Record<string, unknown> = {
    status: file.status,
    rawStatus: file.rawStatus,
    path: file.path,
    previousPath: file.previousPath,
    similarity: file.similarity,
    generatedLikely,
    detailLevel: "summary-only",
  };

  if (!includeDetails) {
    result.diffOmittedReason = "file detail limit reached";
    return result;
  }

  if (budget.remainingBytes <= 0) {
    result.diffOmittedReason = "diff budget exhausted";
    return result;
  }

  const diff = file.status === "untracked"
    ? {
        text: undefined,
        lineCount: 0,
        byteCount: 0,
        omittedReason: "untracked file has no git diff against merge base",
        truncated: false,
      }
    : await loadPerFileDiff(
        $,
        ctx.worktree,
        mergeBase,
        target,
        file,
        limits.maxDiffLines,
        limits.maxDiffBytes,
      );

  const diffBytes = Buffer.byteLength(diff.text ?? "", "utf8");
  budget.remainingBytes -= diffBytes;

  result.diff = diff.text;
  result.diffTruncated = diff.truncated;
  result.diffOmittedReason = diff.omittedReason;
  result.detailLevel = diff.text ? "diff-only" : "summary-only";

  if (generatedLikely) {
    result.contentOmittedReason = "probable generated artifact";
    return result;
  }

  if (budget.remainingBytes <= 0) {
    result.contentOmittedReason = "content budget exhausted";
    return result;
  }

  if (file.status === "deleted") {
    const previousContent = await loadSnapshotFromGit(
      $,
      ctx.worktree,
      mergeBase,
      file.path,
      limits.maxContentLines,
      Math.min(limits.maxContentBytes, budget.remainingBytes),
    );

    if (previousContent) {
      budget.remainingBytes -= Math.min(previousContent.byteCount, limits.maxContentBytes);
      result.previousContent = previousContent;
      result.detailLevel = previousContent.text ? "full" : result.detailLevel;
    }

    return result;
  }

  const currentContent = await loadCurrentSnapshot(
    $,
    ctx,
    target,
    file.path,
    limits.maxContentLines,
    Math.min(limits.maxContentBytes, budget.remainingBytes),
  );

  if (currentContent) {
    budget.remainingBytes -= Math.min(currentContent.byteCount, limits.maxContentBytes);
    result.currentContent = currentContent;
    result.detailLevel = currentContent.text ? "full" : result.detailLevel;
  }

  return result;
}

export function createReviewLoadTool($: Shell) {
  return tool({
    description: "Load a token-aware review pack for a branch or PR",
    args: {
      mode: tool.schema.enum(["branch", "pr"]).describe("Review branch changes or a pull request"),
      pr: tool.schema.string().optional().describe("PR number or URL when mode is pr"),
      base: tool.schema.string().optional().describe("Base branch or ref override"),
      reviews: tool.schema.boolean().optional().describe("Include prior PR review summaries"),
      comments: tool.schema.boolean().optional().describe("Include prior PR review comments"),
      ticket: tool.schema
        .string()
        .optional()
        .describe("Explicit linked ticket reference to load, such as #123 or owner/repo#123"),
      ticketComments: tool.schema
        .boolean()
        .optional()
        .describe("Include comments for the linked ticket when one is loaded"),
      maxFiles: tool.schema.number().int().positive().optional().describe("Maximum files to expand with diffs and content"),
      maxTotalBytes: tool.schema
        .number()
        .int()
        .positive()
        .optional()
        .describe("Approximate output budget across diffs and file contents"),
      maxDiffLines: tool.schema.number().int().positive().optional().describe("Maximum diff lines per file"),
      maxContentLines: tool.schema.number().int().positive().optional().describe("Maximum content lines per file"),
    },
    async execute(
      args: {
        mode: ReviewMode;
        pr?: string;
        base?: string;
        reviews?: boolean;
        comments?: boolean;
        ticket?: string;
        ticketComments?: boolean;
        maxFiles?: number;
        maxTotalBytes?: number;
        maxDiffLines?: number;
        maxContentLines?: number;
      },
      ctx: PluginContext,
    ) {
      const repo = await loadRepoName($, ctx.worktree);
      const branch = await loadBranchName($, ctx.worktree);
      const statusProc = await $`git status --short`.cwd(ctx.worktree).quiet().nothrow();
      const status = nonEmptyLines(statusProc.text());

      const prInfo = args.mode === "pr" ? await loadPullRequest($, ctx.worktree, args.pr) : undefined;
      const comparisonTarget = await resolveComparisonTarget(
        $,
        ctx.worktree,
        args.mode,
        prInfo?.headRefOid,
      );
      const baseRef = await resolvePreferredBaseRef(
        $,
        ctx.worktree,
        args.base ?? prInfo?.baseRefName,
      );
      const mergeBase = await resolveMergeBase(
        $,
        ctx.worktree,
        baseRef,
        comparisonTarget.kind === "commit" ? comparisonTarget.ref : undefined,
      );

      const trackedFiles = await loadTrackedFiles($, ctx.worktree, mergeBase, comparisonTarget);
      const untrackedFiles =
        comparisonTarget.kind === "worktree" ? await loadUntrackedFiles($, ctx.worktree) : [];

      const allFiles = [...trackedFiles];
      const seenPaths = new Set(allFiles.map((file) => file.path));
      for (const file of untrackedFiles) {
        if (!seenPaths.has(file.path)) {
          allFiles.push(file);
        }
      }

      const commitLogProc = comparisonTarget.kind === "commit"
        ? await $`git log --format=%H%x09%s ${baseRef}..${comparisonTarget.ref}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : await $`git log --format=%H%x09%s ${baseRef}..HEAD`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

      const priorReviews =
        args.mode === "pr" && args.reviews
          ? await $`gh api repos/${repo}/pulls/${prInfo.number}/reviews`
              .cwd(ctx.worktree)
              .quiet()
              .nothrow()
          : undefined;
      const priorComments =
        args.mode === "pr" && args.comments
          ? await $`gh api repos/${repo}/pulls/${prInfo.number}/comments`
              .cwd(ctx.worktree)
              .quiet()
              .nothrow()
          : undefined;

      const linkedTickets = args.ticket?.trim()
        ? [args.ticket.trim()]
        : args.mode === "pr"
          ? extractIssueReferences(prInfo?.body ?? "")
          : [];

      const ticket = linkedTickets.length === 1
        ? await loadIssue($, ctx.worktree, ctx.worktree, linkedTickets[0], Boolean(args.ticketComments))
        : undefined;

      const budget = { remainingBytes: args.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES };
      const maxFiles = args.maxFiles ?? DEFAULT_MAX_FILES;
      const detailedFiles: Record<string, unknown>[] = [];
      for (const [index, file] of allFiles.entries()) {
        detailedFiles.push(
          await buildReviewFile(
            $,
            ctx,
            file,
            mergeBase,
            comparisonTarget,
            budget,
            {
              maxDiffLines: args.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES,
              maxDiffBytes: DEFAULT_MAX_DIFF_BYTES,
              maxContentLines: args.maxContentLines ?? DEFAULT_MAX_CONTENT_LINES,
              maxContentBytes: DEFAULT_MAX_CONTENT_BYTES,
            },
            index < maxFiles,
          ),
        );
      }

      const summary = {
        totalFiles: detailedFiles.length,
        byStatus: {} as Record<string, number>,
        byDetailLevel: {} as Record<string, number>,
      };

      for (const file of detailedFiles) {
        const statusName = String(file.status ?? "unknown");
        summary.byStatus[statusName] = (summary.byStatus[statusName] ?? 0) + 1;

        const detailLevel = String(file.detailLevel ?? "summary-only");
        summary.byDetailLevel[detailLevel] = (summary.byDetailLevel[detailLevel] ?? 0) + 1;
      }

      return stringifyJson({
        mode: args.mode,
        repo,
        worktree: ctx.worktree,
        branch,
        status,
        comparison: {
          baseRef,
          mergeBase,
          head: comparisonTarget.kind === "commit" ? comparisonTarget.ref : "WORKTREE",
          headMode: comparisonTarget.kind,
          localWorktreeUsed: comparisonTarget.kind === "worktree",
        },
        pr: prInfo ? simplifyPullRequest(prInfo) : undefined,
        reviews:
          priorReviews?.exitCode === 0 ? simplifyReviews(JSON.parse(priorReviews.text())) : undefined,
        comments:
          priorComments?.exitCode === 0
            ? simplifyComments(JSON.parse(priorComments.text()))
            : undefined,
        ticket,
        ticketCandidates: linkedTickets.length > 1 ? linkedTickets : undefined,
        commits: parseCommitList(commitLogProc.text()),
        summary,
        files: detailedFiles,
      });
    },
  });
}
