import { renderTemplate } from "../lib/components.ts";
import {
  getConfiguredAgentNames,
  getConfiguredCommandNames,
  getConfiguredToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  type AgentDefinition,
  type AgentName,
  type CommandName,
  type ToolName,
} from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

export interface ResolvedAgentDefinition
  extends Omit<AgentDefinition, "promptPath"> {
  prompt?: string;
}

// Re-export agent definitions from config for compile script
export function getAgentDefinitions(config: ReturnType<typeof mergeWithDefaults>): Record<string, AgentDefinition> {
  return {
    worker: config.agents.worker,
    reviewer: config.agents.reviewer,
    planner: config.agents.planner,
  };
}

export async function resolveAgents(
  projectRoot: string,
  options?: {
    names?: {
      tools?: Partial<Record<ToolName, { name: string }>>;
      commands?: Partial<Record<CommandName, { name: string }>>;
      agents?: Partial<Record<AgentName, { name: string }>>;
    };
  },
): Promise<Record<string, ResolvedAgentDefinition>> {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agentDefinitions = getAgentDefinitions(config);
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
  const agents: Record<string, ResolvedAgentDefinition> = {};

  for (const name of config.agents.enabled) {
    const definition = agentDefinitions[name];
    if (!definition) continue;

    const resolvedName = names.agents[name as AgentName]?.name ?? name;

    agents[resolvedName] = {
      description: definition.description,
      mode: definition.mode,
      ...(definition.promptPath
        ? {
            prompt: renderTemplate(await loadProjectText(definition.promptPath), {}, {
              config: {
                shared: config.shared,
                tools: names.tools,
                commands: names.commands,
                agents: names.agents,
              },
            }),
          }
        : {}),
      permission: definition.permission,
    };
  }

  return agents;
}
