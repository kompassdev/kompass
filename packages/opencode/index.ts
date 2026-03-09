import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";

import { createTools, type ToolArgDefinition, type ToolDefinition } from "@kompassdev/core";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";

function createArgSchema(definition: ToolArgDefinition) {
  let schema: any;

  // what a useless comment
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

function wrapTool(definition: ToolDefinition) {
  return tool({
    description: definition.description,
    args: Object.fromEntries(
      Object.entries(definition.args).map(([name, argDefinition]) => [
        name,
        createArgSchema(argDefinition),
      ]),
    ),
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
