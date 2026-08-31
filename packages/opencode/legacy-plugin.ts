import type { Config as SDKConfig, Project, createOpencodeClient } from "@opencode-ai/sdk";
import { z } from "zod";

export type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  worktree: string;
  abort: AbortSignal;
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void;
  ask(input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

export type ToolResult = string | {
  title?: string;
  output: string;
  metadata?: Record<string, unknown>;
};

export function tool<Args extends z.ZodRawShape>(input: {
  description: string;
  args: Args;
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>;
}) {
  return input;
}

tool.schema = z;

export type ToolDefinition = ReturnType<typeof tool>;

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
