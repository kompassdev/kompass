import type { Config } from "@opencode-ai/sdk";

import { loadCompassConfig, mergeWithDefaults } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

interface CommandDefinition {
  description: string;
  agent: string;
  templatePath: string;
}

const commandDefinitions: Record<string, CommandDefinition> = {
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
};

async function loadComponents(
  componentPaths: Record<string, string>,
): Promise<Record<string, string>> {
  const components: Record<string, string> = {};

  for (const [name, path] of Object.entries(componentPaths)) {
    try {
      components[name] = await loadProjectText(path);
    } catch {
      // Component file doesn't exist, skip
    }
  }

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

export async function applyCommandsConfig(cfg: Config, projectRoot: string) {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  cfg.command ??= {};

  const components = await loadComponents(config.components.paths);

  for (const name of config.commands.enabled) {
    const definition = commandDefinitions[name];
    if (!definition) continue;

    // Use custom template path if configured
    const templatePath =
      config.commands.templates[name] || definition.templatePath;

    let template: string;
    try {
      const rawTemplate = await loadProjectText(templatePath);
      // Only embed components if using default template
      template = config.commands.templates[name]
        ? rawTemplate
        : embedComponents(rawTemplate, components);
    } catch {
      // Template file doesn't exist, skip
      continue;
    }

    cfg.command[name] ??= {
      description: definition.description,
      agent: definition.agent,
      subtask: true,
      template,
    };
  }
}
