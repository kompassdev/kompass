import { tool } from "@opencode-ai/plugin/tool";

import { loadRepoName, stringifyJson, type PluginContext, type Shell } from "./shared.ts";

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
  "commits",
].join(",");

async function loadPaginatedArray($: Shell, cwd: string, endpoint: string) {
  const proc = await $`gh api --paginate --slurp ${endpoint}`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || `Failed to load ${endpoint}`);
  }

  const pages = JSON.parse(proc.text()) as unknown[];
  return pages.flatMap((page) => (Array.isArray(page) ? page : [page]));
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

export function createPrLoadTool($: Shell) {
  return tool({
    description: "Load PR metadata and review history",
    args: {
      pr: tool.schema.string().optional().describe("PR number or URL"),
      reviews: tool.schema
        .boolean()
        .optional()
        .describe("Include review summaries"),
      comments: tool.schema
        .boolean()
        .optional()
        .describe("Include review comments"),
    },
    async execute(
      args: { pr?: string; reviews?: boolean; comments?: boolean },
      ctx: PluginContext,
    ) {
      const proc = args.pr
        ? await $`gh pr view ${args.pr} --json ${prJsonKeys}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow()
        : await $`gh pr view --json ${prJsonKeys}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to load PR");
      }

      const info = JSON.parse(proc.text());
      const repo = await loadRepoName($, ctx.worktree);
      const viewerProc = await $`gh api user`.cwd(ctx.worktree).quiet().nothrow();

      if (viewerProc.exitCode !== 0) {
        throw new Error(viewerProc.stderr.toString() || "Failed to load GitHub viewer");
      }

      const reviews = args.reviews
        ? await loadPaginatedArray(
            $,
            ctx.worktree,
            `repos/${repo}/pulls/${info.number}/reviews?per_page=100`,
          )
        : undefined;
      const comments = args.comments
        ? await loadPaginatedArray(
            $,
            ctx.worktree,
            `repos/${repo}/pulls/${info.number}/comments?per_page=100`,
          )
        : undefined;
      return stringifyJson({
        repo,
        viewer: {
          login: JSON.parse(viewerProc.text()).login,
        },
        pr: simplifyPullRequest(info),
        reviews: reviews ? simplifyReviews(reviews) : undefined,
        comments: comments ? simplifyComments(comments) : undefined,
      });
    },
  });
}
