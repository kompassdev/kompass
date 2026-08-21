import type { Plugin } from "@opencode-ai/plugin";

import type { ResolvedAgentDefinition, ResolvedCommandDefinition } from "../core/index.ts";
import type { PluginLogger } from "./logging.ts";

type AgentDraft = Parameters<Parameters<Plugin.Context["agent"]["transform"]>[0]>[0];
type CommandDraft = Parameters<Parameters<Plugin.Context["command"]["transform"]>[0]>[0];

type ApplyConfigOptions = {
  logger?: PluginLogger;
};

export function applyAgentsConfig(
  draft: AgentDraft,
  agents: Record<string, ResolvedAgentDefinition>,
  options?: ApplyConfigOptions,
) {
  for (const [name, definition] of Object.entries(agents)) {
    draft.update(name, (agent) => {
      agent.description = definition.description;
      agent.permissions.push(...Object.entries(definition.permission).map(([action, effect]) => ({
        action,
        resource: "*",
        effect: effect as "allow" | "ask" | "deny",
      })));
      agent.system = definition.prompt;
      if (definition.mode) agent.mode = definition.mode;
    });

    options?.logger?.info("Loaded Kompass agent", {
      agent: name,
      mode: definition.mode,
      promptLength: definition.prompt?.length ?? 0,
    });
  }
}

export function applyCommandsConfig(
  draft: CommandDraft,
  commands: Record<string, ResolvedCommandDefinition>,
  options?: ApplyConfigOptions,
) {
  for (const [name, definition] of Object.entries(commands)) {
    draft.update(name, (command) => {
      command.description = definition.description;
      command.agent = definition.agent;
      command.subtask = definition.subtask;
      command.template = definition.template;
    });

    options?.logger?.info("Loaded Kompass command", {
      command: name,
      agent: definition.agent,
      subtask: definition.subtask,
      templateLength: definition.template.length,
    });
  }
}
