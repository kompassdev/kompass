import { Plugin } from "@opencode/plugin";
import { z } from "zod";

import {
  getEnabledToolNames,
  type ResolvedAgentDefinition,
  type ResolvedCommandDefinition,
} from "../core/index.ts";
import {
  loadMergedKompassConfig,
  loadResolvedAgents,
  loadResolvedCommands,
} from "./cache.ts";
import { createPluginLogger } from "./logging.ts";
import { createCoreOpenCodeToolDefinitions } from "./shared-tools.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";
import { createRiftWorktreeStrategy } from "./rift-worktree.ts";

type PluginContext = Plugin.Context;
type ToolDraft = Parameters<Parameters<PluginContext["tool"]["transform"]>[0]>[0];
type OpenCodeTool = Parameters<ToolDraft["add"]>[0];

function toOpenCodeTool(
  name: string,
  definition: ReturnType<typeof createCoreOpenCodeToolDefinitions>[string],
  projectRoot: string,
): OpenCodeTool {
  return {
    name,
    description: definition.description,
    input: z.object(definition.args) as OpenCodeTool["input"],
    options: { codemode: false },
    async execute(args) {
      const result = await definition.execute(args as never, {
        worktree: projectRoot,
        directory: projectRoot,
      } as never);
      const content = typeof result === "string" ? result : result.output;
      return { output: JSON.parse(content), content };
    },
  };
}

export async function createOpenCodeV2Tools(projectRoot: string): Promise<OpenCodeTool[]> {
  const config = await loadMergedKompassConfig(projectRoot);
  const definitions = createCoreOpenCodeToolDefinitions(config, projectRoot);

  return getEnabledToolNames(config.tools).flatMap((toolName) => {
    const definition = definitions[toolName];
    if (!definition) return [];
    const name = getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name);
    return [toOpenCodeTool(name, definition, projectRoot)];
  });
}

function applyAgents(
  draft: Parameters<Parameters<PluginContext["agent"]["transform"]>[0]>[0],
  agents: Record<string, ResolvedAgentDefinition>,
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
  }
}

function applyCommands(
  draft: Parameters<Parameters<PluginContext["command"]["transform"]>[0]>[0],
  commands: Record<string, ResolvedCommandDefinition>,
  ctx: PluginContext,
  projectRoot: string,
) {
  for (const [name, definition] of Object.entries(commands)) {
    draft.add({
      name,
      description: definition.description,
      async execute({ sessionID, prompt, delivery }) {
        let targetSessionID = sessionID;
        if (definition.subtask) {
          const session = await ctx.session.create({
            agent: definition.agent,
            location: {
              directory: projectRoot,
              ...(ctx.location.workspaceID ? { workspaceID: ctx.location.workspaceID } : {}),
            },
          });
          targetSessionID = session.id as typeof sessionID;
        } else if (definition.agent) {
          await ctx.session.switchAgent({ sessionID, agent: definition.agent });
        }
        await ctx.session.prompt({
          ...prompt,
          sessionID: targetSessionID,
          text: definition.template.includes("$ARGUMENTS")
            ? definition.template.replaceAll("$ARGUMENTS", () => prompt.text)
            : `${definition.template}\n\n${prompt.text}`.trim(),
          delivery,
        });
      },
    });
  }
}

export async function setupOpenCodeV2(ctx: PluginContext) {
  const projectRoot = ctx.location.directory;
  const logger = createPluginLogger(projectRoot);
  const [agents, commands, tools] = await Promise.all([
    loadResolvedAgents(projectRoot),
    loadResolvedCommands(projectRoot),
    createOpenCodeV2Tools(projectRoot),
  ]);
  const agentRegistration = await ctx.agent.transform((draft) => applyAgents(draft, agents));
  const commandRegistration = await ctx.command.transform((draft) => applyCommands(draft, commands, ctx, projectRoot));
  const toolRegistration = await ctx.tool.transform((draft) => {
    for (const tool of tools) draft.add(tool);
  });
  const worktreeRegistration = await ctx.worktree.transform((draft) => {
    draft.add(createRiftWorktreeStrategy());
  });
  logger.info("Initialized Kompass v2 plugin", { directory: projectRoot, tools: tools.length });
  return async () => {
    await Promise.all([
      agentRegistration.dispose(),
      commandRegistration.dispose(),
      toolRegistration.dispose(),
      worktreeRegistration.dispose(),
    ]);
  };
}

export const OpenCodeCompassPluginV2 = Plugin.define({
  id: "kompass",
  setup: setupOpenCodeV2,
});
