import { loadProjectText } from "../lib/text.ts";

const agentDefinitions = {
  reviewer: {
    description: "Review diffs, PRs, and existing feedback without editing files.",
    promptPath: "agents/reviewer.txt",
    permission: {
      "*": "allow",
      edit: "deny",
      todowrite: "deny",
      todoread: "deny",
      ticket_create: "deny",
    },
  },
  planner: {
    description: "Turn requests or tickets into scoped implementation plans.",
    promptPath: "agents/planner.txt",
    permission: {
      "*": "allow",
      edit: "deny",
      todowrite: "deny",
      todoread: "deny",
    },
  },
} as const;

export async function applyAgentsConfig(cfg: any) {
  cfg.agent ??= {};

  await Promise.all(
    Object.entries(agentDefinitions).map(async ([name, definition]) => {
      cfg.agent[name] ??= {
        mode: "subagent",
        description: definition.description,
        prompt: await loadProjectText(definition.promptPath),
        permission: definition.permission,
      };
    }),
  );
}
