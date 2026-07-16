import { renderTemplate } from "../lib/components.ts";
import {
  getConfiguredAgentNames,
  getConfiguredCommandNames,
  getConfiguredToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  type AgentName,
  type CommandName,
  type ToolName,
} from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

interface CommandDefinition {
  description: string;
  agent: string;
  templatePath: string;
  subtask?: boolean;
  templateData?: Record<string, unknown>;
}

export const commandDefinitions: Record<string, CommandDefinition> = {
  ask: {
    description: "Answer questions about the current project or code",
    agent: "worker",
    templatePath: "commands/ask.md",
  },
  branch: {
    description: "Create a feature branch from current changes",
    agent: "worker",
    templatePath: "commands/branch.md",
  },
  "branch/inline": {
    description: "Create a branch using context from the current session",
    agent: "worker",
    templatePath: "commands/branch.md",
    subtask: false,
    templateData: { inline: true },
  },
  commit: {
    description: "Commit current changes with a message",
    agent: "worker",
    templatePath: "commands/commit.md",
  },
  "commit/inline": {
    description: "Commit changes using context from the current session",
    agent: "worker",
    templatePath: "commands/commit.md",
    subtask: false,
    templateData: { inline: true },
  },
  "commit-and-push": {
    description: "Commit and push current changes",
    agent: "worker",
    templatePath: "commands/commit-and-push.md",
  },
  "commit-and-push/inline": {
    description: "Commit and push using context from the current session",
    agent: "worker",
    templatePath: "commands/commit-and-push.md",
    subtask: false,
    templateData: { inline: true },
  },
  dev: {
    description: "Implement a request and prepare it for PR creation",
    agent: "worker",
    templatePath: "commands/dev.md",
  },
  learn: {
    description: "Extract learnings from session to AGENTS.md files",
    agent: "worker",
    templatePath: "commands/learn.md",
    subtask: false,
  },
  "pr/fix/loop": {
    description: "Watch PR CI and comments, repeatedly fixing both without approval prompts",
    agent: "worker",
    templatePath: "commands/pr/fix/loop.md",
  },
  merge: {
    description: "Merge a branch and auto-resolve conflicts best-effort",
    agent: "worker",
    templatePath: "commands/merge.md",
  },
  "pr/create": {
    description: "Summarize branch work and create a PR",
    agent: "worker",
    templatePath: "commands/pr/create.md",
  },
  "pr/create/inline": {
    description: "Create a PR in the current session",
    agent: "worker",
    templatePath: "commands/pr/create.md",
    subtask: false,
    templateData: { inline: true },
  },
  "pr/fix": {
    description: "Fix PR feedback or CI failures, push updates, and reply",
    agent: "worker",
    templatePath: "commands/pr/fix.md",
  },
  "pr/review": {
    description: "Review the current PR and publish review feedback",
    agent: "reviewer",
    templatePath: "commands/pr/review.md",
  },
  review: {
    description: "Review branch changes without publishing comments",
    agent: "reviewer",
    templatePath: "commands/review.md",
  },
  "skill/create": {
    description: "Create a focused Agent Skill from repo context",
    agent: "worker",
    templatePath: "commands/skill/create.md",
  },
  "skill/optimize": {
    description: "Improve an existing Agent Skill from real feedback",
    agent: "worker",
    templatePath: "commands/skill/optimize.md",
  },
  ship: {
    description: "Ship branch work through commit and PR creation",
    agent: "worker",
    templatePath: "commands/ship.md",
  },
  "ship/inline": {
    description: "Ship branch work using context from the current session",
    agent: "worker",
    templatePath: "commands/ship.md",
    subtask: false,
    templateData: { inline: true },
  },
  rmslop: {
    description: "Remove AI code slop from current branch",
    agent: "worker",
    templatePath: "commands/rmslop.md",
  },
  todo: {
    description: "Work through a todo file task by task",
    agent: "worker",
    templatePath: "commands/todo.md",
  },
  "ticket/ask": {
    description: "Answer a question on a ticket and post the response",
    agent: "worker",
    templatePath: "commands/ticket/ask.md",
  },
  "ticket/dev": {
    description: "Implement a ticket and create a PR",
    agent: "worker",
    templatePath: "commands/ticket/dev.md",
  },
  "ticket/create": {
    description: "Summarize current change comparison and create a ticket",
    agent: "worker",
    templatePath: "commands/ticket/create.md",
  },
  "ticket/plan": {
    description: "Plan work from a request or ticket and display the result",
    agent: "planner",
    templatePath: "commands/ticket/plan.md",
  },
  "ticket/plan-and-sync": {
    description: "Plan work from a request or ticket and sync the result",
    agent: "planner",
    templatePath: "commands/ticket/plan-and-sync.md",
  },
};

export interface ResolvedCommandDefinition
  extends Omit<CommandDefinition, "templatePath"> {
  template: string;
  subtask: boolean;
  config?: Record<string, unknown>;
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
  options?: {
    ci?: boolean;
    names?: {
      tools?: Partial<Record<ToolName, { name: string }>>;
      commands?: Partial<Record<CommandName, { name: string }>>;
      agents?: Partial<Record<AgentName, { name: string }>>;
    };
  },
): Promise<Record<string, ResolvedCommandDefinition>> {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const isCi = options?.ci ?? !!process.env.CI;

  const components = await loadComponents(config.components.paths);
  const names = {
    tools: {
      ...getConfiguredToolNames(config.tools),
      ...(options?.names?.tools ?? {}),
    },
    commands: {
      ...getConfiguredCommandNames(config.commands),
      ...(options?.names?.commands ?? {}),
    },
    agents: {
      ...getConfiguredAgentNames(config.agents),
      ...(options?.names?.agents ?? {}),
    },
  };
  const commands: Record<string, ResolvedCommandDefinition> = {};

  for (const name of config.commands.enabled) {
    const definition = commandDefinitions[name];
    if (!definition) continue;

    // Use custom template path if configured
    const templatePath =
      config.commands.templates[name] || definition.templatePath;

    let template: string;
    const commandConfig = {
      enabled: true,
      ...(config.commands.entries[name] ?? {}),
    };
    const templateData = {
      ...(definition.templateData ?? {}),
      ...commandConfig,
      config: {
        shared: config.shared,
        tools: names.tools,
        commands: names.commands,
        agents: names.agents,
      },
    };

    try {
      const rawTemplate = await loadProjectText(templatePath);
      template = renderTemplate(rawTemplate, components, templateData);
    } catch {
      // Template file doesn't exist, skip
      continue;
    }

    const resolvedName = names.commands[name as CommandName]?.name ?? name;

    commands[resolvedName] = {
      description: definition.description,
      agent: names.agents[definition.agent as AgentName]?.name ?? definition.agent,
      subtask: definition.subtask ?? !isCi,
      template,
      ...(Object.keys(commandConfig).length > 0 ? { config: commandConfig } : {}),
    };
  }

  return commands;
}
