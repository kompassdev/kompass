import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

type TicketSyncArgs = {
  title: string;
  body?: string;
  description?: string;
  labels?: string[];
  checklists?: Array<{
    name: string;
    items: Array<{
      name: string;
      completed: boolean;
    }>;
  }>;
  refUrl?: string;
};

function quote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

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
  if (!body) {
    throw new Error("ticket_sync requires body, description, or checklist content");
  }

  return body;
}

function renderLabelFlags(flagName: string, labels?: string[]) {
  return (labels ?? [])
    .filter((label) => label.trim())
    .map((label) => `${flagName} ${quote(label.trim())}`)
    .join(" ");
}

export function createTicketSyncTool($: Shell) {
  return {
    description: "Create or update a GitHub issue",
    args: {
      title: { type: "string", description: "Issue title" },
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
    },
    async execute(args: TicketSyncArgs, ctx: ToolExecutionContext) {
      const body = renderTicketBody(args);

      if (args.refUrl) {
        const addLabelFlags = renderLabelFlags("--add-label", args.labels);
        const command = [
          "gh issue edit",
          quote(args.refUrl),
          "--title",
          quote(args.title),
          "--body",
          quote(body),
          addLabelFlags,
        ]
          .filter(Boolean)
          .join(" ");
        const proc = await $`${command}`
          .cwd(ctx.worktree)
          .quiet()
          .nothrow();

        if (proc.exitCode !== 0) {
          throw new Error(proc.stderr.toString() || "Failed to update issue");
        }

        return stringifyJson({
          url: args.refUrl,
        });
      }

      const labelFlags = renderLabelFlags("--label", args.labels);
      const command = [
        "gh issue create",
        "--title",
        quote(args.title),
        "--body",
        quote(body),
        labelFlags,
      ]
        .filter(Boolean)
        .join(" ");
      const proc = await $`${command}`
        .cwd(ctx.worktree)
        .quiet()
        .nothrow();

      if (proc.exitCode !== 0) {
        throw new Error(proc.stderr.toString() || "Failed to create issue");
      }

      return stringifyJson({
        url: proc.text().trim(),
      });
    },
  } satisfies ToolDefinition<TicketSyncArgs>;
}
