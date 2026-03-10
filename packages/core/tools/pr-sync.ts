import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

type PrSyncArgs = {
  title: string;
  body?: string;
  description?: string;
  base?: string;
  checklists?: Array<{
    name: string;
    items: Array<{
      name: string;
      completed: boolean;
    }>;
  }>;
  draft?: boolean;
  refUrl?: string;
};

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
  if (!body) {
    throw new Error("pr_sync requires body, description, or checklist content");
  }

  return body;
}

export function createPrSyncTool($: Shell) {
  return {
    description: "Create or update a GitHub pull request",
    args: {
      title: { type: "string", description: "PR title" },
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
        description: "Optional PR URL to update instead of creating a new PR",
      },
    },
    async execute(args: PrSyncArgs, ctx: ToolExecutionContext) {
      const body = renderPrBody(args);

      if (args.refUrl) {
        // Update existing PR
        const updateArgs = ["--title", args.title, "--body", body];
        if (args.base) {
          updateArgs.push("--base", args.base);
        }

        const proc = await $`gh pr edit ${args.refUrl} ${updateArgs}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to update PR");
        }

        return stringifyJson({
          url: args.refUrl,
          action: "updated",
        });
      }

      // Create new PR
      const createArgs: string[] = [];
      if (args.base) {
        createArgs.push("--base", args.base);
      }
      if (args.draft) {
        createArgs.push("--draft");
      }

      const proc = await $`gh pr create --title ${args.title} --body ${body} ${createArgs}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to create PR");
      }

      return stringifyJson({
        url: proc.text().trim(),
        action: "created",
      });
    },
  } satisfies ToolDefinition<PrSyncArgs>;
}
