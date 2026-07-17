import { loadRepoName, stringifyJson, type Shell, type ToolDefinition, type ToolExecutionContext } from "./shared.ts";
import {
  loadPaginatedArray,
  loadReviewThreads,
  loadViewerLogin,
  simplifyIssueComments,
  simplifyReviews,
  simplifyThreads,
} from "./pr-load.ts";

function after(value: unknown, since: number) {
  return typeof value === "string" && Date.parse(value) > since;
}

export function createPrLoadReviewTool($: Shell) {
  return {
    description: "Load PR reviews, comments, and threads updated after a timestamp",
    args: {
      pr: { type: "string", optional: true, description: "PR number or URL" },
      since: { type: "string", description: "Exclusive ISO-8601 review checkpoint" },
    },
    async execute(
      args: { pr?: string; since: string },
      ctx: ToolExecutionContext,
    ) {
      const sinceTime = Date.parse(args.since);
      if (!Number.isFinite(sinceTime)) {
        throw new Error("since must be a valid ISO-8601 timestamp");
      }

      const loadedAt = new Date().toISOString();
      const proc = args.pr
        ? await $`gh pr view ${args.pr} --json number,url`.cwd(ctx.worktree).quiet().nothrow()
        : await $`gh pr view --json number,url`.cwd(ctx.worktree).quiet().nothrow();
      if (proc.exitCode !== 0) throw new Error(proc.stderr.toString() || "Failed to resolve PR");

      const pr = JSON.parse(proc.text());
      const repo = await loadRepoName($, ctx.worktree);
      const [owner, repoName] = repo.split("/");
      const viewerLogin = await loadViewerLogin($, ctx.worktree);
      const encodedSince = encodeURIComponent(args.since);
      const reviews = simplifyReviews(await loadPaginatedArray(
        $,
        ctx.worktree,
        `repos/${repo}/pulls/${pr.number}/reviews?per_page=100`,
      )).filter((review) => after(review.submittedAt, sinceTime));
      const issueComments = simplifyIssueComments(await loadPaginatedArray(
        $,
        ctx.worktree,
        `repos/${repo}/issues/${pr.number}/comments?per_page=100&since=${encodedSince}`,
      )).filter((comment) => after(comment.updatedAt ?? comment.createdAt, sinceTime));
      const threads = simplifyThreads(
        await loadReviewThreads($, ctx.worktree, owner, repoName, pr.number),
      ).filter((thread) => thread.comments.some(
        (comment: { updatedAt?: string; createdAt?: string }) => after(comment.updatedAt ?? comment.createdAt, sinceTime),
      ));

      return stringifyJson({ loadedAt, repo, viewerLogin, pr, reviews, issueComments, threads });
    },
  } satisfies ToolDefinition<{ pr?: string; since: string }>;
}
