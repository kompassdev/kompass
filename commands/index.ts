import { loadProjectText } from "../lib/text.ts";

const commandDefinitions = {
  "pr/create": {
    description: "Summarize branch work and create a PR",
    agent: "build",
    templatePath: "commands/pr/create.txt",
  },
  "pr/review": {
    description: "Review the current PR and publish review feedback",
    agent: "reviewer",
    templatePath: "commands/pr/review.txt",
  },
  "pr/fix": {
    description: "Fix PR feedback, push updates, and reply",
    agent: "build",
    templatePath: "commands/pr/fix.txt",
  },
  "ticket/plan": {
    description: "Plan work from a request and create a ticket",
    agent: "planner",
    templatePath: "commands/ticket/plan.txt",
  },
  "ticket/dev": {
    description: "Implement a ticket and create a PR",
    agent: "build",
    templatePath: "commands/ticket/dev.txt",
  },
  review: {
    description: "Review branch changes without publishing comments",
    agent: "reviewer",
    templatePath: "commands/review.txt",
  },
  dev: {
    description: "Implement a request and create a PR",
    agent: "build",
    templatePath: "commands/dev.txt",
  },
} as const;

export async function applyCommandsConfig(cfg: any) {
  cfg.command ??= {};

  await Promise.all(
    Object.entries(commandDefinitions).map(async ([name, definition]) => {
      cfg.command[name] ??= {
        description: definition.description,
        agent: definition.agent,
        subtask: true,
        template: await loadProjectText(definition.templatePath),
      };
    }),
  );
}
