import { access, readFile } from "node:fs/promises";

import {
  loadRepoName,
  parseIssueReference,
  resolveInputPath,
  stringifyJson,
  type Shell,
  type ToolExecutionContext,
} from "../shared.ts";
import {
  renderTicketBody,
  type TicketLoadArgs,
  type TicketProvider,
  type TicketSyncArgs,
} from "./interface.ts";
import { TicketProviderName } from "./interface.ts";

const issueJsonKeys = "number,title,body,url,state,labels,assignees,author";

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function collectValues(values?: string[]) {
  return (values ?? []).filter((value) => value.trim()).map((value) => value.trim());
}

export function createGitHubProvider($: Shell): TicketProvider {
  return {
    name: TicketProviderName.GitHub,
    canLoad(source) {
      return Boolean(parseIssueReference(source));
    },
    canSync(refUrl) {
      return !refUrl || Boolean(parseIssueReference(refUrl));
    },
    async load(args: TicketLoadArgs, context: ToolExecutionContext) {
      const source = args.source.trim();
      const issue = parseIssueReference(source);

      if (issue) {
        const repo = issue.repo ?? (await loadRepoName($, context.worktree));
        const proc = await $`gh issue view ${issue.number} --repo ${repo} --json ${issueJsonKeys}`
          .cwd(context.worktree).quiet().nothrow();
        if (proc.exitCode !== 0) throw new Error(proc.stderr.toString() || "Failed to load issue");

        const comments = args.comments
          ? await $`gh issue view ${issue.number} --repo ${repo} --comments --json comments`
              .cwd(context.worktree).quiet().nothrow()
          : undefined;
        return stringifyJson({
          kind: "github-issue",
          repo,
          issue: JSON.parse(proc.text()),
          comments: comments?.exitCode === 0 ? JSON.parse(comments.text()).comments : undefined,
        });
      }

      const filePath = resolveInputPath(context.directory, source);
      if (await fileExists(filePath)) {
        return stringifyJson({ kind: "file", path: filePath, body: await readFile(filePath, "utf8") });
      }
      return stringifyJson({ kind: "text", body: args.source });
    },
    async sync(args: TicketSyncArgs, context: ToolExecutionContext) {
      const body = renderTicketBody(args);
      const labels = collectValues(args.labels);
      const assignees = collectValues(args.assignees);
      const comments = collectValues(args.comments);

      if (args.refUrl) {
        if (!body && !args.title?.trim() && !labels.length && !assignees.length && !comments.length) {
          throw new Error("ticket_sync requires title, body, description, checklist content, labels, or comments when updating an issue");
        }
        if (body || args.title?.trim() || labels.length || assignees.length) {
          const editArgs = [
            ...(args.title?.trim() ? ["--title", args.title.trim()] : []),
            ...(body ? ["--body", body] : []),
            ...labels.flatMap((label) => ["--add-label", label]),
            ...assignees.flatMap((assignee) => ["--add-assignee", assignee]),
          ];
          const proc = await $`gh issue edit ${args.refUrl} ${editArgs}`
            .cwd(context.worktree).quiet().nothrow();
          if (proc.exitCode !== 0) throw new Error(proc.stderr.toString() || "Failed to update issue");
        }
        for (const comment of comments) await postComment($, context.worktree, args.refUrl, comment);
        return stringifyJson({ url: args.refUrl });
      }

      if (!args.title?.trim()) throw new Error("ticket_sync requires title when creating an issue");
      if (!body) throw new Error("ticket_sync requires body, description, or checklist content when creating an issue");
      const proc = await $`gh issue create --title ${args.title.trim()} --body ${body} ${labels.flatMap((label) => ["--label", label])} ${assignees.flatMap((assignee) => ["--assignee", assignee])}`
        .cwd(context.worktree).quiet().nothrow();
      if (proc.exitCode !== 0) throw new Error(proc.stderr.toString() || "Failed to create issue");
      const url = proc.text().trim();
      for (const comment of comments) await postComment($, context.worktree, url, comment);
      return stringifyJson({ url });
    },
  };
}

async function postComment($: Shell, worktree: string, issueRef: string, body: string) {
  const proc = await $`gh issue comment ${issueRef} --body ${body}`.cwd(worktree).quiet().nothrow();
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString() || "Failed to post issue comment");
}
