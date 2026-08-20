import type { ToolExecutionContext } from "../shared.ts";

export const TicketProviderName = {
  GitHub: "github",
  Jira: "jira",
} as const;

export type TicketProviderName = (typeof TicketProviderName)[keyof typeof TicketProviderName];

export type TicketLoadArgs = {
  source: string;
  comments?: boolean;
};

export type TicketSyncArgs = {
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
  projectKey?: string;
  refUrl?: string;
  comments?: string[];
};

export interface TicketProvider {
  readonly name: TicketProviderName;
  canLoad(source: string): boolean;
  canSync(refUrl?: string): boolean;
  load(args: TicketLoadArgs, context: ToolExecutionContext): Promise<string>;
  sync(args: TicketSyncArgs, context: ToolExecutionContext): Promise<string>;
}

export function renderTicketBody(args: TicketSyncArgs) {
  if (args.body?.trim()) return args.body.trim();

  const sections: string[] = [];
  if (args.description?.trim()) sections.push(args.description.trim());

  for (const checklist of args.checklists ?? []) {
    const items = checklist.items
      .map((item) => `- [${item.completed ? "x" : " "}] ${item.name}`)
      .join("\n");
    if (items) sections.push(`### ${checklist.name}\n\n${items}`);
  }

  return sections.join("\n\n").trim() || undefined;
}
