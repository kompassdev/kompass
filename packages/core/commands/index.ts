import { embedComponents } from "../lib/components.ts";
import { loadKompassConfig, mergeWithDefaults } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

interface CommandDefinition {
  description: string;
  agent: string;
  templatePath: string;
  subtask?: boolean;
}

export const commandDefinitions: Record<string, CommandDefinition> = {
  commit: {
    description: "Commit current changes with a message",
    agent: "build",
    templatePath: "commands/commit.txt",
  },
  "commit-and-push": {
    description: "Commit and push current changes",
    agent: "build",
    templatePath: "commands/commit-and-push.txt",
  },
  dev: {
    description: "Implement a request and create a PR",
    agent: "build",
    templatePath: "commands/dev.txt",
  },
  learn: {
    description: "Extract learnings from session to AGENTS.md files",
    agent: "build",
    templatePath: "commands/learn.txt",
    subtask: false,
  },
  "pr/create": {
    description: "Summarize branch work and create a PR",
    agent: "build",
    templatePath: "commands/pr/create.txt",
  },
  "pr/fix": {
    description: "Fix PR feedback, push updates, and reply",
    agent: "build",
    templatePath: "commands/pr/fix.txt",
  },
  "pr/review": {
    description: "Review the current PR and publish review feedback",
    agent: "reviewer",
    templatePath: "commands/pr/review.txt",
  },
  review: {
    description: "Review branch changes without publishing comments",
    agent: "reviewer",
    templatePath: "commands/review.txt",
  },
  rmslop: {
    description: "Remove AI code slop from current branch",
    agent: "build",
    templatePath: "commands/rmslop.txt",
  },
  "ticket/dev": {
    description: "Implement a ticket and create a PR",
    agent: "build",
    templatePath: "commands/ticket/dev.txt",
  },
  "ticket/create": {
    description: "Summarize completed work and create a ticket",
    agent: "build",
    templatePath: "commands/ticket/create.txt",
  },
  "ticket/plan": {
    description: "Plan work from a request or ticket and sync the result",
    agent: "planner",
    templatePath: "commands/ticket/plan.txt",
  },
};

export interface ResolvedCommandDefinition
  extends Omit<CommandDefinition, "templatePath"> {
  template: string;
  subtask: boolean;
}

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

export async function resolveCommands(
  projectRoot: string,
  options?: { ci?: boolean },
): Promise<Record<string, ResolvedCommandDefinition>> {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const isCi = options?.ci ?? !!process.env.CI;

  const components = await loadComponents(config.components.paths);
  const commands: Record<string, ResolvedCommandDefinition> = {};

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
      // Custom templates bypass component expansion (allows users full control)
      template = config.commands.templates[name]
        ? rawTemplate
        : embedComponents(rawTemplate, components);
    } catch {
      // Template file doesn't exist, skip
      continue;
    }

    commands[name] = {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask ?? !isCi,
      template,
    };
  }

  return commands;
}
