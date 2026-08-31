import { Plugin } from "@opencode-ai/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

type PluginContext = Plugin.Context;
type ToolDraft = Parameters<Parameters<PluginContext["tool"]["transform"]>[0]>[0];
type OpenCodeTool = Parameters<ToolDraft["add"]>[0];
const execFileAsync = promisify(execFile);

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
    if (!draft.get(name)) {
      throw new Error(`OpenCode v2 agent "${name}" must be registered before Kompass setup`);
    }
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

const argumentPattern = /(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi;
const placeholderPattern = /\$(\d+)/g;
const shellPattern = /!`([^`]+)`/g;

export async function expandCommand(template: string, input: string, projectRoot: string) {
  const args = (input.match(argumentPattern) ?? []).map((arg) => arg.replace(/^['"]|['"]$/g, ""));
  const placeholders = template.match(placeholderPattern) ?? [];
  const last = Math.max(0, ...placeholders.map((item) => Number(item.slice(1))));
  const expanded = template.replaceAll(placeholderPattern, (_, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    if (index >= args.length) return "";
    return index + 1 === last ? args.slice(index).join(" ") : args[index] ?? "";
  });
  const withArguments = expanded.replaceAll("$ARGUMENTS", input);
  const text = placeholders.length === 0 && !template.includes("$ARGUMENTS") && input.trim()
    ? `${withArguments}\n\n${input}`.trim()
    : withArguments.trim();
  const matches = Array.from(text.matchAll(shellPattern));
  const outputs = await Promise.all(matches.map(async (match) => {
    try {
      const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", match[1] ?? ""], {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      return `${stdout}${stderr}`;
    } catch (error) {
      const failed = error as { stdout?: unknown; stderr?: unknown; message?: unknown };
      return `${String(failed.stdout ?? "")}${String(failed.stderr ?? failed.message ?? "")}`;
    }
  }));
  const iterator = outputs[Symbol.iterator]();
  return text.replace(shellPattern, () => iterator.next().value ?? "");
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
          text: await expandCommand(definition.template, prompt.text, projectRoot),
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
  await ctx.agent.transform((draft) => applyAgents(draft, agents));
  await ctx.command.transform((draft) => applyCommands(draft, commands, ctx, projectRoot));
  await ctx.tool.transform((draft) => {
    for (const tool of tools) draft.add(tool);
  });
  logger.info("Initialized Kompass v2 plugin", { directory: projectRoot, tools: tools.length });
}

export const OpenCodeCompassPluginV2 = Plugin.define({
  id: "kompass",
  setup: setupOpenCodeV2,
});
