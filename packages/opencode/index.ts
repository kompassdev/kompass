import { tool, type Plugin, type PluginInput } from "@opencode-ai/plugin";

import { createTools, type ToolArgDefinition, type ToolDefinition } from "@kompassdev/core";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";

function createArgSchema(definition: ToolArgDefinition) {
  let schema: any;

  switch (definition.type) {
    case "string":
      schema = tool.schema.string();
      break;
    case "boolean":
      schema = tool.schema.boolean();
      break;
    case "number":
      schema = tool.schema.number();
      if (definition.int) {
        schema = schema.int();
      }
      if (definition.positive) {
        schema = schema.positive();
      }
      break;
  }

  if (definition.optional) {
    schema = schema.optional();
  }

  return schema.describe(definition.description);
}

function createToolArgs(definitions: Record<string, ToolArgDefinition>) {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [name, createArgSchema(definition)]),
  );
}

function wrapTool(definition: ToolDefinition) {
  return tool({
    description: definition.description,
    args: createToolArgs(definition.args),
    execute: definition.execute,
  });
}

export async function createOpenCodeTools(
  $: PluginInput["$"],
  projectRoot: string,
) {
  const toolDefinitions = await createTools($, projectRoot);

  return Object.fromEntries(
    Object.entries(toolDefinitions).map(([name, definition]) => [
      name,
      wrapTool(definition),
    ]),
  );
}

export const OpenCodeCompassPlugin: Plugin = async ({ $, worktree }: PluginInput) => {
  return {
    tool: await createOpenCodeTools($, worktree),
    async config(cfg) {
      await applyAgentsConfig(cfg, worktree);
      await applyCommandsConfig(cfg, worktree);
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPlugin;
