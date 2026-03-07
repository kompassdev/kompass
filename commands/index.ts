import type { Config } from "@opencode-ai/sdk";

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

const componentMap: Record<string, string> = {
  "pr-author": "components/pr-author.txt",
  "dev-flow": "components/dev-flow.txt",
  "ticket-plan": "components/ticket-plan.txt",
  "pr-fix": "components/pr-fix.txt",
  "pr-review": "components/pr-review.txt",
};

async function loadComponents(): Promise<Record<string, string>> {
  const components: Record<string, string> = {};

  await Promise.all(
    Object.entries(componentMap).map(async ([name, path]) => {
      components[name] = await loadProjectText(path);
    }),
  );

  return components;
}

function embedComponents(
  template: string,
  components: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return components[name] || match;
  });
}

export async function applyCommandsConfig(cfg: Config) {
  cfg.command ??= {};

  const components = await loadComponents();

  await Promise.all(
    Object.entries(commandDefinitions).map(async ([name, definition]) => {
      const rawTemplate = await loadProjectText(definition.templatePath);
      const template = embedComponents(rawTemplate, components);

      cfg.command![name] ??= {
        description: definition.description,
        agent: definition.agent,
        subtask: true,
        template,
      };
    }),
  );
}
