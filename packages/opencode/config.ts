import type { AgentConfig, Config } from "@opencode-ai/sdk";

import {
  loadKompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "@kompassdev/core";
import { prefixKompassToolReferences } from "./tool-names.ts";

export async function applyAgentsConfig(cfg: Config, projectRoot: string) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agents = await resolveAgents(projectRoot);
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, config.tools.enabled);

  cfg.agent ??= {};

  for (const [name, definition] of Object.entries(agents)) {
    const agentConfig: AgentConfig = {
      mode: config.adapters.opencode.agentMode,
      description: definition.description,
      prompt: rewriteToolNames(definition.prompt),
      permission: definition.permission,
    };
    cfg.agent[name] ??= agentConfig;
  }
}

export async function applyCommandsConfig(cfg: Config, projectRoot: string) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const commands = await resolveCommands(projectRoot);
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, config.tools.enabled);

  cfg.command ??= {};

  for (const [name, definition] of Object.entries(commands)) {
    cfg.command[name] ??= {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask,
      template: rewriteToolNames(definition.template),
    };
  }
}
