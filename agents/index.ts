import type { AgentConfig, Config } from "@opencode-ai/sdk";

import { loadProjectText } from "../lib/text.ts";

const agentDefinitions = {
  reviewer: {
    description: "Review diffs, PRs, and existing feedback without editing files.",
    promptPath: "agents/reviewer.txt",
    permission: {
      edit: "deny",
    },
  },
  planner: {
    description: "Turn requests or tickets into scoped implementation plans.",
    promptPath: "agents/planner.txt",
    permission: {
      edit: "deny",
    },
  },
} as const;

export async function applyAgentsConfig(cfg: Config) {
  cfg.agent ??= {};

  await Promise.all(
    Object.entries(agentDefinitions).map(async ([name, definition]) => {
      const agentConfig: AgentConfig = {
        mode: "subagent",
        description: definition.description,
        prompt: await loadProjectText(definition.promptPath),
        permission: definition.permission,
      };
      cfg.agent![name] ??= agentConfig;
    }),
  );
}
