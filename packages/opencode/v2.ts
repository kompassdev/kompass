import { Agent, Plugin } from "@opencode/plugin/effect";
import { Tool } from "@opencode/schema/tool";
import { Effect } from "effect";
import { z } from "zod";

import {
  getEnabledToolNames,
  type MergedKompassConfig,
  type ResolvedAgentDefinition,
  type ResolvedCommandDefinition,
} from "../core/index.ts";
import { loadMergedKompassConfig, loadResolvedAgents, loadResolvedCommands } from "./cache.ts";
import { createPluginLogger } from "./logging.ts";
import { createCoreOpenCodeToolDefinitions } from "./shared-tools.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";
import { createRiftWorktreeStrategy } from "./rift-worktree.ts";
import { createNavigatorV2Tools } from "./navigator-v2.ts";

export function createOpenCodeV2Tools(projectRoot: string, config: MergedKompassConfig): Tool.Info[] {
  const definitions = createCoreOpenCodeToolDefinitions(config, projectRoot);
  return getEnabledToolNames(config.tools).flatMap((toolName): Tool.Info[] => {
    const definition = definitions[toolName];
    if (!definition) return [];
    return [{
      name: getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
      description: definition.description,
      input: z.object(definition.args),
      options: { codemode: false },
      execute: (args) => Effect.tryPromise({
        // The shared core uses Promises. Give each invocation its own shell and
        // Effect's cancellation signal at that boundary.
        try: async (signal) => {
          const current = createCoreOpenCodeToolDefinitions(config, projectRoot, signal)[toolName]!;
          const result = await current.execute(args, { worktree: projectRoot, directory: projectRoot });
          const content = typeof result === "string" ? result : result.output;
          return { output: JSON.parse(content), content };
        },
        catch: (error) => new Tool.Error({ message: error instanceof Error ? error.message : String(error) }),
      }),
    }];
  });
}

function applyAgents(
  draft: Parameters<Parameters<Plugin.Context["agent"]["transform"]>[0]>[0],
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
  draft: Parameters<Parameters<Plugin.Context["command"]["transform"]>[0]>[0],
  commands: Record<string, ResolvedCommandDefinition>,
  ctx: Plugin.Context,
) {
  for (const [name, definition] of Object.entries(commands)) {
    draft.add({
      name,
      description: definition.description,
      execute: Effect.fn(`kompass.command.${name}`)(function* ({ sessionID, prompt, delivery }) {
        // V2 commands always execute in the invoking session, regardless of
        // the shared definition's V1 subtask setting.
        if (definition.agent) {
          yield* ctx.session.switchAgent({ sessionID, agent: Agent.ID.make(definition.agent) });
        }
        yield* ctx.session.prompt({
          ...prompt,
          sessionID,
          text: definition.template.includes("$ARGUMENTS")
            ? definition.template.replaceAll("$ARGUMENTS", () => prompt.text)
            : `${definition.template}\n\n${prompt.text}`.trim(),
          delivery,
        });
      }),
    });
  }
}

export const setupOpenCodeV2 = Effect.fn("kompass.setupV2")(function* (ctx: Plugin.Context) {
  const projectRoot = ctx.location.directory;
  const [config, agents, commands] = yield* Effect.all([
    Effect.promise(() => loadMergedKompassConfig(projectRoot)),
    Effect.promise(() => loadResolvedAgents(projectRoot)),
    Effect.promise(() => loadResolvedCommands(projectRoot)),
  ], { concurrency: "unbounded" });
  const tools = [...createOpenCodeV2Tools(projectRoot, config), ...createNavigatorV2Tools(ctx, config)];

  // Native transforms attach their registrations to the plugin scope, including
  // when setup fails partway through. The host owns their disposal.
  yield* ctx.agent.transform((draft) => applyAgents(draft, agents));
  yield* ctx.command.transform((draft) => applyCommands(draft, commands, ctx));
  yield* ctx.tool.transform((draft) => {
    for (const tool of tools) draft.add(tool);
  });
  yield* ctx.worktree.transform((draft) => {
    draft.add(createRiftWorktreeStrategy());
  });
  createPluginLogger(projectRoot).info("Initialized Kompass v2 plugin", { directory: projectRoot, tools: tools.length });
});

export const OpenCodeCompassPluginV2 = Plugin.define({ id: "kompass", effect: setupOpenCodeV2 });
