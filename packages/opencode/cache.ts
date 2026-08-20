import {
  getConfiguredAgentNames,
  getConfiguredCommandNames,
  getConfiguredToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  type AgentName,
  type CommandName,
  resolveAgents,
  resolveCommands,
  type MergedKompassConfig,
  type ResolvedAgentDefinition,
  type ResolvedCommandDefinition,
  type ToolName,
} from "../core/index.ts";
import {
  getConfiguredOpenCodeToolName,
} from "./tool-names.ts";

const mergedConfigCache = new Map<string, Promise<MergedKompassConfig>>();
const configuredNamesCache = new Map<string, Promise<ConfiguredNames>>();
const resolvedAgentsCache = new Map<string, Promise<Record<string, ResolvedAgentDefinition>>>();
const resolvedCommandsCache = new Map<string, Promise<Record<string, ResolvedCommandDefinition>>>();

type ConfiguredNames = {
  tools: Record<ToolName, { name: string }>;
  commands: Record<CommandName, { name: string }>;
  agents: Record<AgentName, { name: string }>;
};

function readThroughCache<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  return pending;
}

export function loadMergedKompassConfig(projectRoot: string): Promise<MergedKompassConfig> {
  return readThroughCache(mergedConfigCache, projectRoot, async () => {
    const userConfig = await loadKompassConfig(projectRoot);
    return mergeWithDefaults(userConfig);
  });
}

export function loadConfiguredNames(projectRoot: string): Promise<ConfiguredNames> {
  return readThroughCache(configuredNamesCache, projectRoot, async () => {
    const config = await loadMergedKompassConfig(projectRoot);
    return {
      tools: Object.fromEntries(
        Object.entries(getConfiguredToolNames(config.tools)).map(([toolName, toolConfig]) => [
          toolName,
          {
            name: getConfiguredOpenCodeToolName(
              toolName,
              toolConfig.name === toolName ? undefined : toolConfig.name,
            ),
          },
        ]),
      ) as Record<ToolName, { name: string }>,
      commands: getConfiguredCommandNames(config.commands),
      agents: getConfiguredAgentNames(config.agents),
    };
  });
}

export function loadResolvedAgents(projectRoot: string): Promise<Record<string, ResolvedAgentDefinition>> {
  return readThroughCache(resolvedAgentsCache, projectRoot, async () => {
    const names = await loadConfiguredNames(projectRoot);
    return resolveAgents(projectRoot, { names });
  });
}

export function loadResolvedCommands(projectRoot: string): Promise<Record<string, ResolvedCommandDefinition>> {
  const ciKey = process.env.CI ? "ci" : "non-ci";
  const cacheKey = `${projectRoot}:${ciKey}`;
  return readThroughCache(resolvedCommandsCache, cacheKey, async () => {
    const names = await loadConfiguredNames(projectRoot);
    return resolveCommands(projectRoot, { names });
  });
}
