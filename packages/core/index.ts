export { resolveAgents, getAgentDefinitions } from "./agents/index.ts";
export type { ResolvedAgentDefinition } from "./agents/index.ts";
export { resolveCommands, commandDefinitions } from "./commands/index.ts";
export type { ResolvedCommandDefinition } from "./commands/index.ts";
export { loadCompassConfig, mergeWithDefaults } from "./lib/config.ts";
export type { AgentDefinition, CompassConfig, MergedCompassConfig } from "./lib/config.ts";
export { createTools } from "./tools/index.ts";
export type {
  Shell,
  ShellPromise,
  ToolArgDefinition,
  ToolDefinition,
  ToolExecutionContext,
} from "./tools/shared.ts";
