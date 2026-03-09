import { loadCompassConfig, mergeWithDefaults, type AgentDefinition } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

export interface ResolvedAgentDefinition
  extends Omit<AgentDefinition, "promptPath"> {
  prompt: string;
}

// Re-export agent definitions from config for compile script
export function getAgentDefinitions(config: ReturnType<typeof mergeWithDefaults>): Record<string, AgentDefinition> {
  return {
    reviewer: config.agents.reviewer,
    planner: config.agents.planner,
  };
}

export async function resolveAgents(
  projectRoot: string,
): Promise<Record<string, ResolvedAgentDefinition>> {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agentDefinitions = getAgentDefinitions(config);
  const agents: Record<string, ResolvedAgentDefinition> = {};

  for (const name of config.agents.enabled) {
    const definition = agentDefinitions[name];
    if (!definition) continue;

    agents[name] = {
      description: definition.description,
      prompt: await loadProjectText(definition.promptPath),
      permission: definition.permission,
    };
  }

  return agents;
}
