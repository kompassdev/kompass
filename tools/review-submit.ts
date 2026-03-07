import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { tool } from "@opencode-ai/plugin";

import { loadRepoName, stringifyJson, type PluginContext, type Shell } from "./shared.ts";

const prJsonKeys = ["number", "url", "headRefOid"].join(",");

type Importance = "low" | "medium" | "high" | "critical";

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

function defaultEvent(grade: number) {
  if (grade >= 5) return "APPROVE";
  if (grade <= 2) return "REQUEST_CHANGES";
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

  const lines = [`Review grade: ${grade}/5 stars`];
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
        event?: "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
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
      const prProc = args.pr
        ? await $`gh pr view ${args.pr} --json ${prJsonKeys}`.cwd(ctx.worktree).quiet().nothrow()
        : await $`gh pr view --json ${prJsonKeys}`.cwd(ctx.worktree).quiet().nothrow();

      if (prProc.exitCode !== 0) {
        throw new Error(prProc.stderr.toString() || "Failed to load PR for review submission");
      }

      const pr = JSON.parse(prProc.text());
      const comments = args.comments ?? [];
      const payloadComments = comments.map((comment) => {
        const body = formatInlineBody(comment.body, comment.importance);

        if (comment.subjectType === "file") {
          return {
            path: comment.path,
            body,
            subject_type: "file",
          };
        }

        if (!comment.line) {
          throw new Error(`Inline comment for ${comment.path} is missing a line number`);
        }

        return {
          path: comment.path,
          body,
          line: comment.line,
          side: comment.side ?? "RIGHT",
          start_line: comment.startLine,
          start_side: comment.startLine ? comment.startSide ?? comment.side ?? "RIGHT" : undefined,
        };
      });

      const payload = {
        body: formatReviewBody(args.grade, args.summary, comments),
        event: args.event ?? defaultEvent(args.grade),
        commit_id: pr.headRefOid,
        comments: payloadComments.length > 0 ? payloadComments : undefined,
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
          review: {
            id: response.id,
            state: response.state,
            htmlUrl: response.html_url,
            submittedAt: response.submitted_at,
            event: payload.event,
            grade: args.grade,
          },
          commentsPublished: payloadComments.length,
        });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  });
}
