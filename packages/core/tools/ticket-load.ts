import { access, readFile } from "node:fs/promises";

import {
  loadRepoName,
  parseIssueReference,
  resolveInputPath,
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

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

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function createTicketLoadTool($: Shell) {
  return {
    description: "Load a ticket from GitHub, file, or text",
    args: {
      source: {
        type: "string",
        description: "Issue URL, repo#id, #id, file path, or raw text",
      },
      comments: {
        type: "boolean",
        optional: true,
        description: "Include issue comments",
      },
    },
    async execute(args: { source: string; comments?: boolean }, ctx: ToolExecutionContext) {
      const source = args.source.trim();
      const issue = parseIssueReference(source);

      if (issue) {
        const repo = issue.repo ?? (await loadRepoName($, ctx.worktree));
        const proc = await $`gh issue view ${issue.number} --repo ${repo} --json ${issueJsonKeys}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to load issue");
        }

        const info = JSON.parse(proc.text());
        const comments = args.comments
          ? await $`gh issue view ${issue.number} --repo ${repo} --comments --json comments`
              .cwd(ctx.worktree)
              .quiet()
              .nothrow()
          : undefined;

        return stringifyJson({
          kind: "github-issue",
          repo,
          issue: info,
          comments:
            comments?.exitCode === 0
              ? JSON.parse(comments.text()).comments
              : undefined,
        });
      }

      const filePath = resolveInputPath(ctx.directory, source);
      if (await fileExists(filePath)) {
        return stringifyJson({
          kind: "file",
          path: filePath,
          body: await readFile(filePath, "utf8"),
        });
      }

      return stringifyJson({
        kind: "text",
        body: args.source,
      });
    },
  } satisfies ToolDefinition<{
    source: string;
    comments?: boolean;
  }>;
}
