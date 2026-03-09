import type { AgentConfig, Config } from "@opencode-ai/sdk";

import {
  loadCompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "@kompassdev/core";

export async function applyAgentsConfig(cfg: Config, projectRoot: string) {
  const userConfig = await loadCompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agents = await resolveAgents(projectRoot);

  cfg.agent ??= {};

  for (const [name, definition] of Object.entries(agents)) {
    const agentConfig: AgentConfig = {
      mode: config.adapters.opencode.agentMode,
      description: definition.description,
      prompt: definition.prompt,
      permission: definition.permission,
    };
    cfg.agent[name] ??= agentConfig;
  }
}

export async function applyCommandsConfig(cfg: Config, projectRoot: string) {
  const commands = await resolveCommands(projectRoot);

  cfg.command ??= {};

  for (const [name, definition] of Object.entries(commands)) {
    cfg.command[name] ??= {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask,
      template: definition.template,
    };
  }
}
