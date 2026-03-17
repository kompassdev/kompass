import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

type TicketSyncArgs = {
  title?: string;
  body?: string;
  description?: string;
  labels?: string[];
  assignees?: string[];
  checklists?: Array<{
    name: string;
    items: Array<{
      name: string;
      completed: boolean;
    }>;
  }>;
  refUrl?: string;
  comments?: string[];
};

function renderTicketBody(args: TicketSyncArgs) {
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

    sections.push(`### ${checklist.name}\n\n${items}`);
  }

  const body = sections.join("\n\n").trim();
  return body || undefined;
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

function hasMetadataUpdate(args: TicketSyncArgs, body?: string) {
  return Boolean(
    args.title?.trim() ||
      body ||
      collectLabels(args.labels).length > 0 ||
      collectAssignees(args.assignees).length > 0,
  );
}

async function postIssueComment($: Shell, worktree: string, issueRef: string, body: string) {
  const proc = await $`gh issue comment ${issueRef} --body ${body}`
    .cwd(worktree)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to post issue comment");
  }
}

function collectComments(comments?: string[]): string[] {
  return (comments ?? [])
    .filter((comment) => comment.trim())
    .map((comment) => comment.trim());
}

export function createTicketSyncTool($: Shell) {
  return {
    description: "Create or update a GitHub issue",
    args: {
      title: { type: "string", optional: true, description: "Issue title" },
      body: {
        type: "string",
        optional: true,
        description: "Issue body override; optional when using description/checklists",
      },
      description: {
        type: "string",
        optional: true,
        description: "Short issue description rendered above checklist sections",
      },
      labels: {
        type: "string[]",
        optional: true,
        description: "Labels to apply to the issue",
      },
      assignees: {
        type: "string[]",
        optional: true,
        description: "Assignees to apply to the issue",
      },
      checklists: {
        type: "json",
        optional: true,
        description: "Checklist sections rendered as markdown checklists",
      },
      refUrl: {
        type: "string",
        optional: true,
        description: "Optional issue URL to update instead of creating a new issue",
      },
      comments: {
        type: "string[]",
        optional: true,
        description: "Optional issue comments to post",
      },
    },
    async execute(args: TicketSyncArgs, ctx: ToolExecutionContext) {
      const body = renderTicketBody(args);
      const labels = collectLabels(args.labels);
      const assignees = collectAssignees(args.assignees);
      const comments = collectComments(args.comments);

      if (args.refUrl) {
        if (!hasMetadataUpdate(args, body) && comments.length === 0) {
          throw new Error("ticket_sync requires title, body, description, checklist content, labels, or comments when updating an issue");
        }

        if (hasMetadataUpdate(args, body)) {
          const editArgs = [
            ...(args.title?.trim() ? ["--title", args.title.trim()] : []),
            ...(body ? ["--body", body] : []),
            ...labels.flatMap((label) => ["--add-label", label]),
            ...assignees.flatMap((assignee) => ["--add-assignee", assignee]),
          ];
          const proc = await $`gh issue edit ${args.refUrl} ${editArgs}`
            .cwd(ctx.worktree)
            .quiet()
            .nothrow();

          if (proc.exitCode !== 0) {
            throw new Error(proc.stderr.toString() || "Failed to update issue");
          }
        }

        for (const comment of comments) {
          await postIssueComment($, ctx.worktree, args.refUrl, comment);
        }

        return stringifyJson({
          url: args.refUrl,
        });
      }

      if (!args.title?.trim()) {
        throw new Error("ticket_sync requires title when creating an issue");
      }

      if (!body) {
        throw new Error("ticket_sync requires body, description, or checklist content when creating an issue");
      }

      const labelArgs = labels.flatMap((label) => ["--label", label]);
      const assigneeArgs = assignees.flatMap((assignee) => ["--assignee", assignee]);
      const proc = await $`gh issue create --title ${args.title.trim()} --body ${body} ${labelArgs} ${assigneeArgs}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to create issue");
      }

      const url = proc.text().trim();

      for (const comment of comments) {
        await postIssueComment($, ctx.worktree, url, comment);
      }

      return stringifyJson({
        url,
      });
    },
  } satisfies ToolDefinition<TicketSyncArgs>;
}
