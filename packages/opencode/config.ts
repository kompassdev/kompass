import type { AgentConfig } from "@opencode-ai/sdk";
import type { Config } from "./legacy-plugin.ts";

import { loadResolvedAgents, loadResolvedCommands } from "./cache.ts";
import type { PluginLogger } from "./logging.ts";

type ApplyConfigOptions = {
  logger?: PluginLogger;
};

export async function applyAgentsConfig(
  cfg: Config,
  projectRoot: string,
  options?: ApplyConfigOptions,
) {
  const agents = await loadResolvedAgents(projectRoot);

  cfg.agent ??= {};

  for (const [name, definition] of Object.entries(agents)) {
    const agentConfig: AgentConfig = {
      description: definition.description,
      permission: definition.permission,
      ...(definition.prompt ? { prompt: definition.prompt } : {}),
      ...(definition.mode ? { mode: definition.mode } : {}),
    };
    cfg.agent[name] = agentConfig;

    options?.logger?.info("Loaded Kompass agent", {
      agent: name,
      mode: agentConfig.mode,
      promptLength: definition.prompt?.length ?? 0,
    });
  }
}

export async function applyCommandsConfig(
  cfg: Config,
  projectRoot: string,
  options?: ApplyConfigOptions,
) {
  const commands = await loadResolvedCommands(projectRoot);

  cfg.command ??= {};

  for (const [name, definition] of Object.entries(commands)) {
    cfg.command[name] = {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask,
      template: definition.template,
    };

    options?.logger?.info("Loaded Kompass command", {
      command: name,
      agent: definition.agent,
      subtask: definition.subtask,
      templateLength: definition.template.length,
    });
  }
}
