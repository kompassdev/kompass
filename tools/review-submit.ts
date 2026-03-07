import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { tool } from "@opencode-ai/plugin/tool";

import { loadRepoName, stringifyJson, type PluginContext, type Shell } from "./shared.ts";

const prJsonKeys = ["number", "url", "headRefOid"].join(",");

type Importance = "low" | "medium" | "high" | "critical";
type ReviewEvent = "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
type PreparedComment = {
  path: string;
  body: string;
  importance?: Importance;
  line?: number;
  side?: "LEFT" | "RIGHT";
  start_line?: number;
  start_side?: "LEFT" | "RIGHT";
  subject_type?: "file";
};
type SubmittedComment = {
  path?: string;
  body?: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
  start_line?: number;
  start_side?: "LEFT" | "RIGHT";
  subject_type?: "file";
  user?: { login?: string };
};
type SubmittedReview = {
  id?: number;
  body?: string;
  state?: string;
  user?: { login?: string };
  submitted_at?: string;
};

function formatStars(grade: number) {
  return `${"★".repeat(grade)}${"☆".repeat(5 - grade)}`;
}

function normalizeReviewText(body: string) {
  return body
    .replace(/^\*\*(Critical|High|Medium|Low)\*\*\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseGrade(body?: string) {
  if (!body) return undefined;

  const starMatch = body.match(/Review grade:\s*([★☆]{5})/);
  if (starMatch) {
    return [...starMatch[1]].filter((char) => char === "★").length;
  }

  const numericMatch = body.match(/Review grade:\s*(\d)\/5/);
  if (numericMatch) {
    return Number.parseInt(numericMatch[1], 10);
  }

  return undefined;
}

function commentKey(
  comment: Pick<PreparedComment, "path" | "body" | "line" | "start_line" | "subject_type">,
) {
  return JSON.stringify({
    path: comment.path,
    line: comment.line ?? null,
    startLine: comment.start_line ?? null,
    subjectType: comment.subject_type ?? "line",
    body: normalizeReviewText(comment.body),
  });
}

function labelImportance(importance: Importance) {
  switch (importance) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

function defaultEvent(grade: number): ReviewEvent {
  if (grade >= 5) return "APPROVE";
  return "COMMENT";
}

function formatInlineBody(body: string, importance?: Importance) {
  const trimmed = body.trim();
  if (!importance) {
    return trimmed;
  }

  return `**${labelImportance(importance)}**\n\n${trimmed}`;
}

function formatReviewBody(
  grade: number,
  summary: string,
  comments: Array<{ importance?: Importance }>,
) {
  const counts = comments.reduce(
    (acc, comment) => {
      if (comment.importance) {
        acc[comment.importance] += 1;
      }
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  const findingParts = [
    counts.critical ? `${counts.critical} critical` : "",
    counts.high ? `${counts.high} high` : "",
    counts.medium ? `${counts.medium} medium` : "",
    counts.low ? `${counts.low} low` : "",
  ].filter(Boolean);

  const lines = [`Review grade: ${formatStars(grade)} (${grade}/5)`];
  if (findingParts.length > 0) {
    lines.push(`Findings: ${findingParts.join(", ")}`);
  }
  lines.push("", summary.trim());

  return lines.join("\n");
}

export function createReviewSubmitTool($: Shell) {
  return tool({
    description: "Publish a GitHub PR review with inline comments and a grade",
    args: {
      pr: tool.schema.string().optional().describe("PR number or URL; defaults to the current PR"),
      grade: tool.schema.number().int().min(1).max(5).describe("Overall review grade from 1 to 5"),
      summary: tool.schema.string().describe("Overall review summary to publish"),
      event: tool.schema
        .enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"])
        .optional()
        .describe("Explicit GitHub review event override"),
      comments: tool.schema
        .array(
          tool.schema.object({
            path: tool.schema.string(),
            body: tool.schema.string(),
            importance: tool.schema.enum(["low", "medium", "high", "critical"]).optional(),
            line: tool.schema.number().int().positive().optional(),
            side: tool.schema.enum(["LEFT", "RIGHT"]).optional(),
            startLine: tool.schema.number().int().positive().optional(),
            startSide: tool.schema.enum(["LEFT", "RIGHT"]).optional(),
            subjectType: tool.schema.enum(["line", "file"]).optional(),
          }),
        )
        .optional()
        .describe("Inline comments to publish with the review"),
    },
    async execute(
      args: {
        pr?: string;
        grade: number;
        summary: string;
        event?: ReviewEvent;
        comments?: Array<{
          path: string;
          body: string;
          importance?: Importance;
          line?: number;
          side?: "LEFT" | "RIGHT";
          startLine?: number;
          startSide?: "LEFT" | "RIGHT";
          subjectType?: "line" | "file";
        }>;
      },
      ctx: PluginContext,
    ) {
      const repo = await loadRepoName($, ctx.worktree);
      const viewerProc = await $`gh api user`.cwd(ctx.worktree).quiet().nothrow();
      if (viewerProc.exitCode !== 0) {
        throw new Error(viewerProc.stderr.toString() || "Failed to load GitHub viewer");
      }

      const viewer = JSON.parse(viewerProc.text());
      const viewerLogin = viewer.login;
      const prProc = args.pr
        ? await $`gh pr view ${args.pr} --json ${prJsonKeys}`.cwd(ctx.worktree).quiet().nothrow()
        : await $`gh pr view --json ${prJsonKeys}`.cwd(ctx.worktree).quiet().nothrow();

      if (prProc.exitCode !== 0) {
        throw new Error(prProc.stderr.toString() || "Failed to load PR for review submission");
      }

      const pr = JSON.parse(prProc.text());
      const [existingCommentsProc, existingReviewsProc] = await Promise.all([
        $`gh api repos/${repo}/pulls/${pr.number}/comments`.cwd(ctx.worktree).quiet().nothrow(),
        $`gh api repos/${repo}/pulls/${pr.number}/reviews`.cwd(ctx.worktree).quiet().nothrow(),
      ]);

      if (existingCommentsProc.exitCode !== 0) {
        throw new Error(existingCommentsProc.stderr.toString() || "Failed to load existing PR comments");
      }
      if (existingReviewsProc.exitCode !== 0) {
        throw new Error(existingReviewsProc.stderr.toString() || "Failed to load existing PR reviews");
      }

      const existingComments: Array<
        Pick<PreparedComment, "path" | "body" | "line" | "start_line" | "subject_type">
      > = (JSON.parse(existingCommentsProc.text()) as SubmittedComment[])
        .filter((comment) => comment.user?.login === viewerLogin)
        .map((comment) => ({
          path: comment.path ?? "",
          body: comment.body ?? "",
          line: comment.line,
          start_line: comment.start_line,
          subject_type: comment.subject_type === "file" ? ("file" as const) : undefined,
        }));
      const existingCommentKeys = new Set(existingComments.map((comment) => commentKey(comment)));

      const latestOwnReview = (JSON.parse(existingReviewsProc.text()) as SubmittedReview[])
        .filter((review) => review.user?.login === viewerLogin)
        .sort((left, right) => {
          const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
          const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;
          return rightTime - leftTime;
        })[0];
      const previousGrade = parseGrade(latestOwnReview?.body);
      const gradeChanged = previousGrade !== args.grade;

      const comments = args.comments ?? [];
      const payloadComments: PreparedComment[] = comments.map((comment) => {
        const body = formatInlineBody(comment.body, comment.importance);

        if (comment.subjectType === "file") {
          return {
            path: comment.path,
            body,
            importance: comment.importance,
            subject_type: "file",
          };
        }

        if (!comment.line) {
          throw new Error(`Inline comment for ${comment.path} is missing a line number`);
        }

        return {
          path: comment.path,
          body,
          importance: comment.importance,
          line: comment.line,
          side: comment.side ?? "RIGHT",
          start_line: comment.startLine,
          start_side: comment.startLine ? comment.startSide ?? comment.side ?? "RIGHT" : undefined,
        };
      });

      const uniquePayloadComments: PreparedComment[] = [];
      const seenKeys = new Set<string>();

      for (const comment of payloadComments) {
        const key = commentKey({
          path: comment.path,
          body: comment.body,
          line: comment.line,
          start_line: comment.start_line,
          subject_type: comment.subject_type,
        });

        if (seenKeys.has(key) || existingCommentKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        uniquePayloadComments.push(comment);
      }

      if (!gradeChanged && uniquePayloadComments.length === 0) {
        return stringifyJson({
          repo,
          pr: pr.number,
          url: pr.url,
          skipped: true,
          reason: "grade unchanged and no new comments",
          previousGrade: previousGrade ? formatStars(previousGrade) : undefined,
        });
      }

      const payload = {
        body: gradeChanged ? formatReviewBody(args.grade, args.summary, uniquePayloadComments) : undefined,
        event: gradeChanged ? (args.event ?? defaultEvent(args.grade)) : "COMMENT",
        commit_id: pr.headRefOid,
        comments: uniquePayloadComments.length > 0 ? uniquePayloadComments : undefined,
      };

      const tempDir = await mkdtemp(path.join(os.tmpdir(), "opencode-compass-review-"));
      const payloadPath = path.join(tempDir, "review.json");

      try {
        await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

        const proc = await $`gh api --method POST repos/${repo}/pulls/${pr.number}/reviews --input ${payloadPath}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to submit PR review");
        }

        const response = JSON.parse(proc.text());
        return stringifyJson({
          repo,
          pr: pr.number,
          url: pr.url,
          skipped: false,
          review: {
            id: response.id,
            state: response.state,
            htmlUrl: response.html_url,
            submittedAt: response.submitted_at,
            event: payload.event,
            grade: gradeChanged ? args.grade : undefined,
          },
          previousGrade: previousGrade ? formatStars(previousGrade) : undefined,
          currentGrade: gradeChanged ? formatStars(args.grade) : undefined,
          commentsPublished: uniquePayloadComments.length,
          commentsSkipped: payloadComments.length - uniquePayloadComments.length,
        });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  });
}
