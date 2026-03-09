import type { AgentConfig, Config } from "@opencode-ai/sdk";

import { loadCompassConfig, mergeWithDefaults, type AgentDefinition } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

// Re-export agent definitions from config for compile script
export function getAgentDefinitions(config: ReturnType<typeof mergeWithDefaults>): Record<string, AgentDefinition> {
  return {
    reviewer: config.agents.reviewer,
    planner: config.agents.planner,
  };
}

export async function applyAgentsConfig(cfg: Config, projectRoot: string) {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);

  cfg.agent ??= {};

  const agentDefinitions = getAgentDefinitions(config);

  for (const name of config.agents.enabled) {
    const definition = agentDefinitions[name];
    if (!definition) continue;

    const agentConfig: AgentConfig = {
      mode: config.defaults.agentMode,
      description: definition.description,
      prompt: await loadProjectText(definition.promptPath),
      permission: definition.permission,
    };
    cfg.agent[name] ??= agentConfig;
  }
}
