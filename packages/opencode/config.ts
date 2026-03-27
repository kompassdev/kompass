import type { AgentConfig, Config } from "@opencode-ai/sdk";

import {
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "../core/index.ts";
import {
  getConfiguredOpenCodeToolName,
  prefixKompassToolReferences,
} from "./tool-names.ts";
import type { PluginLogger } from "./logging.ts";

type ApplyConfigOptions = {
  logger?: PluginLogger;
};

export async function applyAgentsConfig(
  cfg: Config,
  projectRoot: string,
  options?: ApplyConfigOptions,
) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agents = await resolveAgents(projectRoot);
  const configuredToolNames = Object.fromEntries(
    getEnabledToolNames(config.tools).map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, configuredToolNames);

  cfg.agent ??= {};

  for (const [name, definition] of Object.entries(agents)) {
    const agentConfig: AgentConfig = {
      description: definition.description,
      permission: definition.permission,
      ...(definition.prompt ? { prompt: rewriteToolNames(definition.prompt) } : {}),
      ...(definition.mode ? { mode: definition.mode } : {}),
    };
    cfg.agent[name] = agentConfig;

    await options?.logger?.info("Loaded Kompass agent", {
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
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const commands = await resolveCommands(projectRoot);
  const configuredToolNames = Object.fromEntries(
    getEnabledToolNames(config.tools).map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, configuredToolNames);

  cfg.command ??= {};

  for (const [name, definition] of Object.entries(commands)) {
    cfg.command[name] = {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask,
      template: rewriteToolNames(definition.template),
    };

    await options?.logger?.info("Loaded Kompass command", {
      command: name,
      agent: definition.agent,
      subtask: definition.subtask,
      templateLength: definition.template.length,
    });
  }
}
