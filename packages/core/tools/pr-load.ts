import {
  loadRepoName,
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
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
  "commits",
  "author",
].join(",");

function countPullRequestCommits(commits: unknown) {
  if (Array.isArray(commits)) {
    return commits.length;
  }

  if (commits && typeof commits === "object" && Array.isArray((commits as any).nodes)) {
    return (commits as any).nodes.length;
  }

  return 0;
}

async function loadPaginatedArray($: Shell, cwd: string, endpoint: string) {
  const proc = await $`gh api --paginate --slurp ${endpoint}`.cwd(cwd).quiet().nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || `Failed to load ${endpoint}`);
  }

  const pages = JSON.parse(proc.text()) as unknown[];
  return pages.flatMap((page) => (Array.isArray(page) ? page : [page]));
}

async function loadReviewThreads($: Shell, cwd: string, owner: string, repo: string, number: number) {
  const threads: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const proc = cursor
      ? await $`gh api graphql -f query=${REVIEW_THREADS_QUERY} -F owner=${owner} -F repo=${repo} -F number=${number} -F cursor=${cursor}`
          .cwd(cwd)
          .quiet()
          .nothrow()
      : await $`gh api graphql -f query=${REVIEW_THREADS_QUERY} -F owner=${owner} -F repo=${repo} -F number=${number}`
          .cwd(cwd)
          .quiet()
          .nothrow();

    if (proc.exitCode !== 0) {
      throw new Error(proc.stderr.toString() || "Failed to load review threads");
    }

    const response = JSON.parse(proc.text());
    const pullRequest = response?.data?.repository?.pullRequest;
    const connection = pullRequest?.reviewThreads;

    if (!connection) {
      break;
    }

    threads.push(...(connection.nodes ?? []));
    if (!connection.pageInfo?.hasNextPage) {
      break;
    }

    cursor = connection.pageInfo.endCursor;
  }

  return threads;
}

async function loadViewerLogin($: Shell, cwd: string) {
  const isGitHubActions = process.env.GITHUB_ACTIONS?.trim() === "true";
  const workflowToken = process.env.GITHUB_TOKEN?.trim();
  if (isGitHubActions && workflowToken) {
    return "github-actions[bot]";
  }

  const actor = process.env.GITHUB_ACTOR?.trim();
  if (actor) {
    return actor;
  }

  const viewerProc = await $`gh api user`.cwd(cwd).quiet().nothrow();
  if (viewerProc.exitCode !== 0) {
    throw new Error(viewerProc.stderr.toString() || "Failed to load GitHub viewer");
  }

  return JSON.parse(viewerProc.text()).login;
}

const REVIEW_THREADS_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          comments(first: 100) {
            nodes {
              id
              author {
                login
              }
              body
              createdAt
              updatedAt
              path
              line
              startLine
              url
            }
          }
        }
      }
    }
  }
}`;

function simplifyPullRequest(info: any) {
  const commitCount = countPullRequestCommits(info.commits);

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
    commitCount,
    author: info.author?.login ?? info.author?.name ?? info.author,
  };
}

function simplifyReviews(reviews: any[]) {
  return reviews
    .map((review) => ({
      id: review.id,
      state: review.state,
      author: review.user?.login,
      ...(typeof review.body === "string" && review.body.trim().length > 0 ? { body: review.body } : {}),
      submittedAt: review.submitted_at,
      commitId: review.commit_id,
    }))
    .filter((review) => review.state === "APPROVED" || typeof review.body === "string");
}

function simplifyIssueComments(comments: any[]) {
  return comments.map((comment) => ({
    id: comment.id,
    author: comment.user?.login,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    body: comment.body,
  }));
}

function simplifyThreads(threads: any[]) {
  return threads.map((thread) => ({
    id: thread.id,
    path: thread.path,
    ...(typeof thread.startLine === "number" && thread.startLine !== thread.line
      ? { startLine: thread.startLine }
      : {}),
    line: thread.line,
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated,
    comments: Array.isArray(thread.comments?.nodes)
      ? thread.comments.nodes.map((comment: any) => ({
          id: comment.id,
          author: comment.author?.login,
          body: comment.body,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        }))
      : [],
  }));
}

export function createPrLoadTool($: Shell) {
  return {
    description: "Load PR metadata and review history",
    args: {
      pr: { type: "string", optional: true, description: "PR number or URL" },
    },
    async execute(
      args: {
        pr?: string;
      },
      ctx: ToolExecutionContext,
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
      const [owner, repoName] = repo.split("/");
      const viewerLogin = await loadViewerLogin($, ctx.worktree);

      const reviews = await loadPaginatedArray(
        $,
        ctx.worktree,
        `repos/${repo}/pulls/${info.number}/reviews?per_page=100`,
      );
      const issueComments = await loadPaginatedArray(
        $,
        ctx.worktree,
        `repos/${repo}/issues/${info.number}/comments?per_page=100`,
      );
      const threads = await loadReviewThreads($, ctx.worktree, owner, repoName, info.number);
      return stringifyJson({
        repo,
        viewerLogin,
        pr: simplifyPullRequest(info),
        reviews: simplifyReviews(reviews),
        issueComments: simplifyIssueComments(issueComments),
        threads: simplifyThreads(threads),
      });
    },
  } satisfies ToolDefinition<{
    pr?: string;
  }>;
}
