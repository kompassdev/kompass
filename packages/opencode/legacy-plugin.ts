import type { Config as SDKConfig, Project, createOpencodeClient } from "@opencode-ai/sdk";
import type { ToolDefinition } from "./shared-tools.ts";

export { tool, type ToolContext, type ToolDefinition, type ToolResult } from "./shared-tools.ts";

export type Config = Omit<SDKConfig, "plugin"> & {
  plugin?: Array<string | [string, Record<string, unknown>]>;
};

export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>;
  project: Project;
  directory: string;
  worktree: string;
  experimental_workspace: {
    register(type: string, adapter: unknown): void;
  };
  serverUrl: URL;
  $: unknown;
};

export type Hooks = {
  config?: (config: Config) => Promise<void>;
  tool?: Record<string, ToolDefinition>;
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> },
  ) => Promise<void>;
};

export type Plugin = (input: PluginInput, options?: Record<string, unknown>) => Promise<Hooks>;
