import {
  loadRepoName,
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

type ReviewComment = {
  path: string;
  body: string;
  line: number;
  startLine?: number;
  side?: "LEFT" | "RIGHT";
  startSide?: "LEFT" | "RIGHT";
};

type ReviewInputBase = {
  body?: string;
  comments?: ReviewComment[];
};

type ReviewInput = ReviewInputBase | (ReviewInputBase & {
  approve?: boolean;
});

type ReviewReply = {
  inReplyTo: number;
  body: string;
};

type PrSyncArgs = {
  title?: string;
  body?: string;
  description?: string;
  base?: string;
  head?: string;
  labels?: string[];
  removeLabels?: string[];
  replaceLabels?: string[];
  assignees?: string[];
  checklists?: Array<{
    name: string;
    items: Array<{
      name: string;
      completed: boolean;
    }>;
  }>;
  draft?: boolean;
  refUrl?: string;
  commitId?: string;
  review?: ReviewInput;
  replies?: ReviewReply[];
  commentBody?: string;
};

function normalizeReviewInput(review?: ReviewInput): ReviewInput | undefined {
  if (!review) {
    return undefined;
  }

  const hasBody = Boolean(review.body?.trim());
  const hasComments = (review.comments?.length ?? 0) > 0;
  const hasApprove = "approve" in review && review.approve === true;

  return hasBody || hasComments || hasApprove ? review : undefined;
}

function renderPrBody(args: PrSyncArgs) {
  if (args.body?.trim()) {
    return args.body.trim();
  }

  const sections: string[] = [];

  if (args.description?.trim()) {
    sections.push(args.description.trim());
  }

  for (const checklist of args.checklists ?? []) {
    const items = checklist.items
      .map((item) => `- [${item.completed ? "x" : " "}] ${item.name}`)
      .join("\n");

    if (!items) {
      continue;
    }

    sections.push(`## ${checklist.name}\n\n${items}`);
  }

  const body = sections.join("\n\n").trim();
  return body || undefined;
}

function hasMetadataUpdate(args: PrSyncArgs, body?: string) {
  return Boolean(
    args.title?.trim() ||
      body ||
      args.base?.trim() ||
      collectLabels(args.labels).length > 0 ||
      collectLabels(args.removeLabels).length > 0 ||
      args.replaceLabels !== undefined ||
      collectAssignees(args.assignees).length > 0,
  );
}

function collectLabels(labels?: string[]): string[] {
  return (labels ?? [])
    .filter((label) => label.trim())
    .map((label) => label.trim());
}

function collectAssignees(assignees?: string[]): string[] {
  return (assignees ?? [])
    .filter((assignee) => assignee.trim())
    .map((assignee) => assignee.trim());
}

function requiresExistingPullRequest(args: PrSyncArgs, review?: ReviewInput) {
  return Boolean(
    review ||
      args.commentBody?.trim() ||
      (args.replies?.length ?? 0) > 0,
  );
}

async function resolvePullRequest($: Shell, worktree: string, ref?: string) {
  const proc = ref?.trim()
    ? await $`gh pr view ${ref.trim()} --json number,url`
        .cwd(worktree)
        .quiet()
        .nothrow()
    : await $`gh pr view --json number,url`
        .cwd(worktree)
        .quiet()
        .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to resolve PR");
  }

  const result = JSON.parse(proc.text());
  return {
    number: Number(result.number),
    url: String(result.url),
  };
}

async function loadRepoContext($: Shell, worktree: string) {
  const repo = await loadRepoName($, worktree);
  const [owner, repoName] = repo.split("/");
  return { repo, owner, repoName };
}

function normalizeReviewComment(comment: ReviewComment) {
  if (!comment.path?.trim()) {
    throw new Error("Review comments require a path");
  }

  if (!comment.body?.trim()) {
    throw new Error("Review comments require a body");
  }

  if (!Number.isInteger(comment.line)) {
    throw new Error("Review comments require a line number");
  }

  const side = comment.side ?? "RIGHT";
  const normalized = {
    path: comment.path.trim(),
    body: comment.body.trim(),
    side,
    line: Math.abs(comment.line),
  } as Record<string, unknown>;

  if (typeof comment.startLine === "number") {
    normalized.start_line = Math.abs(comment.startLine);
    normalized.start_side = comment.startSide ?? side;
  }

  return normalized;
}

async function postGeneralComment($: Shell, worktree: string, prRef: string, body: string) {
  const proc = await $`gh pr comment ${prRef} --body ${body}`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to post PR comment");
  }
}

async function approvePullRequest($: Shell, worktree: string, prRef: string) {
  const proc = await $`gh pr review ${prRef} --approve`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to approve PR");
  }

  return prRef;
}

async function getCurrentUser($: Shell, worktree: string): Promise<string | undefined> {
  const proc = await $`gh api user --jq .login`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    return undefined;
  }

  const login = proc.text().trim();
  return login || undefined;
}

async function requestReviewFromSelf(
  $: Shell,
  worktree: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<boolean> {
  const currentUser = await getCurrentUser($, worktree);
  if (!currentUser) {
    return false;
  }

  const payload = JSON.stringify({ reviewers: [currentUser] });

  const proc = await $`echo ${payload} | gh api --method POST /repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers --input -`
    .cwd(worktree)
    .quiet()
    .nothrow();

  return proc.exitCode === 0;
}

async function submitReview(
  $: Shell,
  worktree: string,
  owner: string,
  repo: string,
  prNumber: number,
  review: ReviewInput,
  commitId?: string,
) {
  const comments = (review.comments ?? []).map(normalizeReviewComment);
  const body = review.body?.trim();

  if (comments.length === 0 && !body) {
    throw new Error("pr_sync review requires body or comments");
  }

  const payload = JSON.stringify({
    event: "COMMENT",
    ...(commitId?.trim() ? { commit_id: commitId.trim() } : {}),
    ...(body ? { body } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });

  const proc = await $`echo ${payload} | gh api --method POST /repos/${owner}/${repo}/pulls/${prNumber}/reviews --input -`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString().trim();
    const stdout = proc.text().trim();
    const errorDetails = stderr || stdout || "Unknown error";
    throw new Error(
      `Failed to submit PR review: ${errorDetails}\n\nPayload: ${payload}`,
    );
  }

  const responseText = proc.text().trim();
  if (!responseText) {
    return undefined;
  }

  const response = JSON.parse(responseText);
  return typeof response.html_url === "string" ? response.html_url : undefined;
}

async function postReply(
  $: Shell,
  worktree: string,
  owner: string,
  repo: string,
  prNumber: number,
  reply: ReviewReply,
) {
  if (!Number.isInteger(reply.inReplyTo)) {
    throw new Error("Reply comments require an inReplyTo value");
  }

  if (!reply.body?.trim()) {
    throw new Error("Reply comments require a body");
  }

  const parentProc = await $`gh api /repos/${owner}/${repo}/pulls/comments/${reply.inReplyTo}`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (parentProc.exitCode !== 0) {
    throw new Error(parentProc.stderr.toString() || "Failed to load parent comment");
  }

  const parent = JSON.parse(parentProc.text());
  const payload = JSON.stringify({
    body: reply.body.trim(),
    commit_id: parent.commit_id,
    path: parent.path,
    line: parent.line,
    in_reply_to: Math.abs(reply.inReplyTo),
  });

  const proc = await $`echo ${payload} | gh api --method POST /repos/${owner}/${repo}/pulls/${prNumber}/comments --input -`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to post reply comment");
  }
}

async function updatePullRequest(
  $: Shell,
  worktree: string,
  refUrl: string,
  args: {
    title?: string;
    body?: string;
    base?: string;
    labels?: string[];
    removeLabels?: string[];
    assignees?: string[];
  },
) {
  const updateArgs: string[] = [];
  if (args.title?.trim()) {
    updateArgs.push("--title", args.title.trim());
  }
  if (args.body) {
    updateArgs.push("--body", args.body);
  }
  if (args.base?.trim()) {
    updateArgs.push("--base", args.base.trim());
  }
  for (const label of collectLabels(args.labels)) {
    updateArgs.push("--add-label", label);
  }
  for (const label of collectLabels(args.removeLabels)) {
    updateArgs.push("--remove-label", label);
  }
  for (const assignee of collectAssignees(args.assignees)) {
    updateArgs.push("--add-assignee", assignee);
  }

  if (updateArgs.length === 0) {
    return false;
  }

  const proc = await $`gh pr edit ${refUrl} ${updateArgs}`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to update PR");
  }

  return true;
}

async function replacePullRequestLabels(
  $: Shell,
  worktree: string,
  owner: string,
  repo: string,
  prNumber: number,
  labels: string[],
) {
  const payload = JSON.stringify({ labels: collectLabels(labels) });
  const proc = await $`echo ${payload} | gh api --method PUT /repos/${owner}/${repo}/issues/${prNumber}/labels --input -`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to replace PR labels");
  }
}

function summarizeActions(actions: string[]) {
  return actions.join("_and_");
}

export function createPrSyncTool($: Shell) {
  return {
    description: "Create, update, or review a GitHub pull request",
    args: {
      title: {
        type: "string",
        optional: true,
        description: "PR title; required when creating a PR or renaming one",
      },
      body: {
        type: "string",
        optional: true,
        description: "PR body override; optional when using description/checklists",
      },
      description: {
        type: "string",
        optional: true,
        description: "Short PR description rendered above checklist sections",
      },
      base: {
        type: "string",
        optional: true,
        description: "Base branch to merge into (defaults to repo default branch)",
      },
      head: {
        type: "string",
        optional: true,
        description: "Head branch to open the PR from when creating a new pull request",
      },
      labels: {
        type: "string[]",
        optional: true,
        description: "Labels to add to the PR",
      },
      removeLabels: {
        type: "string[]",
        optional: true,
        description: "Labels to remove from an existing PR",
      },
      replaceLabels: {
        type: "string[]",
        optional: true,
        description: "Exact label set for the PR; an empty array clears all labels",
      },
      assignees: {
        type: "string[]",
        optional: true,
        description: "Assignees to apply to the PR",
      },
      checklists: {
        type: "json",
        optional: true,
        description: "Checklist sections rendered as markdown checklists",
      },
      draft: {
        type: "boolean",
        optional: true,
        description: "Create as draft PR",
      },
      refUrl: {
        type: "string",
        optional: true,
        description: "Optional PR URL or reference to update instead of creating a new PR",
      },
      commitId: {
        type: "string",
        optional: true,
        description: "Commit SHA to anchor review comments to; omit unless sending review comments",
      },
      review: {
        type: "json",
        optional: true,
        description: "Optional structured PR review submission; omit the field entirely unless submitting a review body, inline comments, or approval",
      },
      replies: {
        type: "json",
        optional: true,
        description: "Replies to existing review comments, each with inReplyTo and body",
      },
      commentBody: {
        type: "string",
        optional: true,
        description: "General PR comment body",
      },
    },
    async execute(args: PrSyncArgs, ctx: ToolExecutionContext) {
      const body = renderPrBody(args);
      const review = normalizeReviewInput(args.review);
      const metadataUpdate = hasMetadataUpdate(args, body);
      const existingPrActions = requiresExistingPullRequest(args, review);

      if (
        args.replaceLabels !== undefined &&
        (args.labels !== undefined || args.removeLabels !== undefined)
      ) {
        throw new Error("pr_sync replaceLabels cannot be combined with labels or removeLabels");
      }

      if (!args.refUrl?.trim() && collectLabels(args.removeLabels).length > 0) {
        throw new Error("pr_sync removeLabels requires refUrl");
      }

      if (!args.refUrl?.trim() && existingPrActions && metadataUpdate) {
        throw new Error("pr_sync requires refUrl when combining PR updates with review, comment, or reply actions");
      }

      if (!args.refUrl?.trim() && !existingPrActions) {
        if (!args.title?.trim()) {
          throw new Error("pr_sync requires title when creating a PR");
        }

        if (!body) {
          throw new Error("pr_sync requires body, description, or checklist content");
        }

        const createArgs: string[] = [];
        if (args.base?.trim()) {
          createArgs.push("--base", args.base.trim());
        }
        const headBranch = args.head?.trim();
        if (headBranch) {
          createArgs.push("--head", headBranch);
        }
        for (const assignee of collectAssignees(args.assignees)) {
          createArgs.push("--assignee", assignee);
        }
        for (const label of collectLabels(args.replaceLabels ?? args.labels)) {
          createArgs.push("--label", label);
        }
        if (args.draft) {
          createArgs.push("--draft");
        }

        const proc = await $`gh pr create --title ${args.title.trim()} --body ${body} ${createArgs}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to create PR");
        }

        return stringifyJson({
          url: proc.text().trim(),
          action: "created",
          actions: ["created"],
        });
      }

      const target = await resolvePullRequest($, ctx.worktree, args.refUrl);
      const actions: string[] = [];
      let repoContext: Awaited<ReturnType<typeof loadRepoContext>> | undefined;

      async function getRepoContext() {
        repoContext ??= await loadRepoContext($, ctx.worktree);
        return repoContext;
      }

      if (metadataUpdate) {
        const updated = await updatePullRequest($, ctx.worktree, target.url, {
          title: args.title,
          body,
          base: args.base,
          labels: args.labels,
          removeLabels: args.removeLabels,
          assignees: args.assignees,
        });
        if (args.replaceLabels !== undefined) {
          const { owner, repoName } = await getRepoContext();
          await replacePullRequestLabels(
            $,
            ctx.worktree,
            owner,
            repoName,
            target.number,
            args.replaceLabels,
          );
        }
        if (updated || args.replaceLabels !== undefined) {
          actions.push("updated");
        }
      }

      if (args.commentBody?.trim()) {
        await postGeneralComment($, ctx.worktree, target.url, args.commentBody.trim());
        actions.push("commented");
      }

      let reviewUrl: string | undefined;

      if (review) {
        // Handle approval separately using gh pr review --approve
        if ("approve" in review && review.approve === true) {
          await approvePullRequest($, ctx.worktree, target.url);
          actions.push("approved");
        }

        // Submit review comments if there are any
        if ((review.comments?.length ?? 0) > 0 || review.body?.trim()) {
          const { owner, repoName } = await getRepoContext();

          // Request review from self to clear any previous approval (best-effort)
          await requestReviewFromSelf($, ctx.worktree, owner, repoName, target.number);

          reviewUrl = await submitReview($, ctx.worktree, owner, repoName, target.number, review, args.commitId);
          actions.push("reviewed");
        }
      }

      if ((args.replies?.length ?? 0) > 0) {
        const { owner, repoName } = await getRepoContext();
        for (const reply of args.replies ?? []) {
          await postReply($, ctx.worktree, owner, repoName, target.number, reply);
        }
        actions.push("replied");
      }

      if (actions.length === 0) {
        throw new Error(
          "pr_sync requires title, body, description, checklist content, label changes, assignees, review, commentBody, or replies",
        );
      }

      return stringifyJson({
        url: target.url,
        action: summarizeActions(actions),
        actions,
        ...(reviewUrl ? { reviewUrl } : {}),
      });
    },
  } satisfies ToolDefinition<PrSyncArgs>;
}
