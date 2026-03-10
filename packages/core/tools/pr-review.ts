import {
  loadRepoName,
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

export function createPrReviewTool($: Shell) {
  return {
    description:
      "Add comments to a PR: general PR comment, inline review comment on specific lines, or reply to existing review threads",
    args: {
      pr: {
        type: "string",
        optional: true,
        description: "PR number or URL (optional, uses current PR if not provided)",
      },
      comment_type: {
        type: "string",
        description: "Type of comment to add: general, inline, or reply",
      },
      body: {
        type: "string",
        description: "Comment text",
      },
      commit_id: {
        type: "string",
        optional: true,
        description: "Commit SHA for inline comments (required for inline type)",
      },
      path: {
        type: "string",
        optional: true,
        description: "File path for inline comments (required for inline type)",
      },
      line: {
        type: "number",
        optional: true,
        description: "Line number for inline comments (required for inline type)",
      },
      in_reply_to: {
        type: "number",
        optional: true,
        description: "Comment ID to reply to (required for reply type)",
      },
    },
    async execute(
      args: {
        pr?: string;
        comment_type: string;
        body: string;
        commit_id?: string;
        path?: string;
        line?: number;
        in_reply_to?: number;
      },
      ctx: ToolExecutionContext,
    ) {
      const { comment_type, body, pr, commit_id, path, line, in_reply_to } = args;

      // Resolve PR number
      let prNumber: string;
      if (pr) {
        const match = pr.match(/\/pull\/(\d+)|^(\d+)$/);
        if (match) {
          prNumber = match[1] || match[2];
        } else {
          throw new Error(`Invalid PR reference: ${pr}`);
        }
      } else {
        const proc = await $`gh pr view --json number -q .number`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();
        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "No current PR found");
        }
        prNumber = proc.text().trim();
      }

      const repo = await loadRepoName($, ctx.worktree);
      const [owner, repoName] = repo.split("/");

      switch (comment_type) {
        case "general": {
          const proc = await $`gh pr comment ${prNumber} --body ${body}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

          if (proc.exitCode !== 0) {
            throw new Error(proc.stderr.toString() || "Failed to post PR comment");
          }

          return stringifyJson({
            type: "general",
            pr: Number(prNumber),
            body: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          });
        }

        case "inline": {
          if (!commit_id || !path || !line) {
            throw new Error("Inline comments require commit_id, path, and line parameters");
          }

          const payload = JSON.stringify({
            body,
            commit_id,
            path,
            line,
          });

          const proc = await $`echo ${payload} | gh api --method POST /repos/${owner}/${repoName}/pulls/${prNumber}/comments --input -`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

          if (proc.exitCode !== 0) {
            throw new Error(proc.stderr.toString() || "Failed to post inline comment");
          }

          return stringifyJson({
            type: "inline",
            pr: Number(prNumber),
            path,
            line,
            body: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          });
        }

        case "reply": {
          if (!in_reply_to) {
            throw new Error("Reply comments require in_reply_to parameter");
          }

          // Fetch parent comment to get required context
          const parentProc = await $`gh api /repos/${owner}/${repoName}/pulls/comments/${in_reply_to}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

          if (parentProc.exitCode !== 0) {
            throw new Error(parentProc.stderr.toString() || "Failed to load parent comment");
          }

          const parent = JSON.parse(parentProc.text());

          const payload = JSON.stringify({
            body,
            commit_id: parent.commit_id,
            path: parent.path,
            line: parent.line,
            in_reply_to,
          });

          const proc = await $`echo ${payload} | gh api --method POST /repos/${owner}/${repoName}/pulls/${prNumber}/comments --input -`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

          if (proc.exitCode !== 0) {
            throw new Error(proc.stderr.toString() || "Failed to post reply comment");
          }

          return stringifyJson({
            type: "reply",
            pr: Number(prNumber),
            in_reply_to,
            body: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          });
        }

        default:
          throw new Error(`Unknown comment type: ${comment_type}`);
      }
    },
  } satisfies ToolDefinition<{
    pr?: string;
    comment_type: string;
    body: string;
    commit_id?: string;
    path?: string;
    line?: number;
    in_reply_to?: number;
  }>;
}
