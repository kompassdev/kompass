import type { Hooks, Plugin, PluginInput } from "./legacy-plugin.ts";
import { createOpencodeClient as createLegacyClient, type OpencodeClient as LegacyClient } from "@opencode-ai/sdk/client";
import { createOpencodeClient as createV2Client, type OpencodeClient as V2Client } from "@opencode-ai/sdk/v2";

import {
  getEnabledToolNames,
} from "../core/index.ts";
import { loadMergedKompassConfig } from "./cache.ts";
import { applyAgentsConfig, applyCommandsConfig } from "./config.ts";
import { createPluginLogger, getErrorDetails, type PluginLogger } from "./logging.ts";
import { createNavigatorTools, detectNavigatorProtocol, getNavigatorCompatibilityWarning } from "./navigator.ts";
import { registerRiftWorkspaceAdapter } from "./rift-workspace.ts";
import { createCoreOpenCodeToolDefinitions, type ToolDefinition } from "./shared-tools.ts";
import { getConfiguredOpenCodeToolName } from "./tool-names.ts";

export { createCoreOpenCodeToolDefinitions, createNodeShell } from "./shared-tools.ts";

type CommandExecuteBeforeHook = NonNullable<Hooks["command.execute.before"]>;
type CommandExecuteBeforeInput = Parameters<CommandExecuteBeforeHook>[0];
type CommandExecuteBeforeOutput = Parameters<CommandExecuteBeforeHook>[1];
export type CommandExecution = {
  command: string;
  arguments: string;
  prompt: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function logObservedFailure(
  logger: PluginLogger,
  message: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  logger.warn(message, {
    ...(extra ?? {}),
    ...getErrorDetails(error),
  });
}

export function getCommandExecution(
  input: CommandExecuteBeforeInput,
  output: CommandExecuteBeforeOutput,
): CommandExecution | undefined {
  const prompt = output.parts
    .flatMap((part) => part.type === "text" ? [part.text] : [])
    .join("\n")
    .trim();

  if (!prompt) return;

  return {
    command: input.command,
    arguments: input.arguments,
    prompt,
  };
}

export async function createOpenCodeTools(
  client: PluginInput["client"],
  projectRoot: string,
  navigator?: {
    client: V2Client;
    legacyClient: (directory: string) => LegacyClient;
    projectID: string;
    protocol: "v1" | "v2";
  },
): Promise<Record<string, ToolDefinition>> {
  const config = await loadMergedKompassConfig(projectRoot);
  const tools: Record<string, ToolDefinition> = {};
  const logger = createPluginLogger(client, projectRoot);
  const coreTools = createCoreOpenCodeToolDefinitions(config, projectRoot);

  const navigatorEnabled = config.adapters.opencode.navigator.enabled;
  let agentNames: string[] | undefined;
  if (navigatorEnabled && navigator) {
    try {
      const response = await navigator.client.v2.agent.list({ location: { directory: projectRoot } });
      agentNames = response.data?.data.map((agent) => agent.id);
    } catch {
      // Target-workspace validation remains authoritative if discovery is unavailable during registration.
    }
  }
  const navigatorTools: Record<string, ToolDefinition> = navigatorEnabled && navigator
    ? createNavigatorTools({
        agentNames,
        client: navigator.client,
        legacyClient: navigator.legacyClient,
        projectID: navigator.projectID,
        checkout: projectRoot,
        config: config.adapters.opencode.navigator,
        protocol: navigator.protocol,
      })
    : {};

  for (const toolName of getEnabledToolNames(config.tools, navigatorEnabled)) {
    const coreTool = coreTools[toolName];
    const navigatorTool = navigatorTools[toolName];
    if (coreTool || navigatorTool) {
      const registeredName = getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name);
      tools[registeredName] = navigatorTool ?? coreTool;
      logger.info("Loaded Kompass tool", {
        tool: toolName,
        registeredName,
      });
    }
  }

  return tools;
}

export const OpenCodeCompassPluginV1: Plugin = async (input: PluginInput) => {
  const { client, worktree } = input;
  const logger = createPluginLogger(client, worktree);

  logger.info("Initialized Kompass plugin", {
    directory: getString(input.directory),
    worktree: getString(worktree),
    projectPath: getString((input as { project?: { path?: string } }).project?.path),
  });

  async function createToolsSafely() {
    try {
      const config = await loadMergedKompassConfig(worktree);
      let navigator: {
        client: V2Client;
        legacyClient: (directory: string) => LegacyClient;
        projectID: string;
        protocol: "v1" | "v2";
      } | undefined;
      if (config.adapters.opencode.navigator.enabled) {
        const projectID = getString(input.project?.id);
        if (!input.serverUrl || !projectID) {
          logger.warn("Navigator requires OpenCode 1.17.12 or newer; Navigator tools were not registered");
        } else {
          const legacyClients = new Map<string, LegacyClient>();
          const navigatorClient = createV2Client({ baseUrl: input.serverUrl.toString() });
          const protocol = await detectNavigatorProtocol(navigatorClient);
          navigator = {
            client: navigatorClient,
            legacyClient(directory) {
              let located = legacyClients.get(directory);
              if (!located) {
                located = createLegacyClient({ baseUrl: input.serverUrl.toString(), directory });
                legacyClients.set(directory, located);
              }
              return located;
            },
            projectID,
            protocol,
          };
          const warning = await getNavigatorCompatibilityWarning(
            navigator.client,
            navigator.protocol,
            navigator.legacyClient(worktree),
          );
          if (warning) {
            logger.warn(`${warning}; Navigator tools were not registered`);
            navigator = undefined;
          }
        }
      }
      return await createOpenCodeTools(client, worktree, navigator);
    } catch (error) {
      logger.warn("Skipping Kompass tool registration", {
        ...getErrorDetails(error),
      });
      return {};
    }
  }

  async function runConfigStep(name: string, register: () => Promise<void>) {
    try {
      await register();
    } catch (error) {
      logger.warn("Skipping Kompass config registration step", {
        step: name,
        worktree,
        ...getErrorDetails(error),
      });
    }
  }

  const tools = await createToolsSafely();
  await registerRiftWorkspaceAdapter(input, logger);

  return {
    tool: tools,
    async config(cfg) {
      await runConfigStep("agents", () => applyAgentsConfig(cfg, worktree, { logger }));
      await runConfigStep("commands", () => applyCommandsConfig(cfg, worktree, { logger }));
    },
    async "command.execute.before"(input, output) {
      try {
        const commandExecution = getCommandExecution(input, output);

        if (!commandExecution) return;

        logger.info("Executing Kompass command", commandExecution as Record<string, unknown>);
      } catch (error) {
        logObservedFailure(logger, "command.execute.before hook failed", error, {
          command: input.command,
          arguments: input.arguments,
          sessionID: input.sessionID,
        });
      }
    },
  };
};

export { applyAgentsConfig, applyCommandsConfig };
export default OpenCodeCompassPluginV1;
