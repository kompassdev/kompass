import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentConfig, Config } from "@opencode-ai/sdk";

import {
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "../core/index.ts";
import {
  getConfiguredOpenCodeToolName,
  prefixKompassToolReferences,
} from "./tool-names.ts";
import type { PluginLogger } from "./logging.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_SKILL_ROOT_CANDIDATES = [
  path.join(__dirname, "skills"),
  path.resolve(__dirname, "..", "skills"),
  path.resolve(__dirname, "..", "core", "skills"),
];

type ConfigWithSkillsPaths = Config & {
  skills?: {
    paths?: string[];
  };
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBundledSkillsRoot(): Promise<string | undefined> {
  for (const candidate of BUNDLED_SKILL_ROOT_CANDIDATES) {
    if (await pathExists(candidate)) return candidate;
  }

  return undefined;
}

type ApplyConfigOptions = {
  logger?: PluginLogger;
};

export async function applyAgentsConfig(
  cfg: Config,
  projectRoot: string,
  options?: ApplyConfigOptions,
) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const agents = await resolveAgents(projectRoot);
  const configuredToolNames = Object.fromEntries(
    getEnabledToolNames(config.tools).map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, configuredToolNames);

  cfg.agent ??= {};

  for (const [name, definition] of Object.entries(agents)) {
    const agentConfig: AgentConfig = {
      mode: config.adapters.opencode.agentMode,
      description: definition.description,
      prompt: rewriteToolNames(definition.prompt),
      permission: definition.permission,
    };
    cfg.agent[name] ??= agentConfig;

    await options?.logger?.info("Loaded Kompass agent", {
      agent: name,
      mode: agentConfig.mode,
      promptLength: definition.prompt.length,
    });
  }
}

export async function applyCommandsConfig(
  cfg: Config,
  projectRoot: string,
  options?: ApplyConfigOptions,
) {
  const userConfig = await loadKompassConfig(projectRoot);
  const config = mergeWithDefaults(userConfig);
  const commands = await resolveCommands(projectRoot);
  const configuredToolNames = Object.fromEntries(
    getEnabledToolNames(config.tools).map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, configuredToolNames);

  cfg.command ??= {};

  for (const [name, definition] of Object.entries(commands)) {
    cfg.command[name] ??= {
      description: definition.description,
      agent: definition.agent,
      subtask: definition.subtask,
      template: rewriteToolNames(definition.template),
    };

    await options?.logger?.info("Loaded Kompass command", {
      command: name,
      agent: definition.agent,
      subtask: definition.subtask,
      templateLength: definition.template.length,
    });
  }
}

export async function applySkillsConfig(cfg: Config, options?: ApplyConfigOptions) {
  const bundledSkillsRoot = await resolveBundledSkillsRoot();
  if (!bundledSkillsRoot) return;

  const skillsConfig = cfg as ConfigWithSkillsPaths;
  skillsConfig.skills ??= {};
  skillsConfig.skills.paths ??= [];

  if (!skillsConfig.skills.paths.includes(bundledSkillsRoot)) {
    skillsConfig.skills.paths.push(bundledSkillsRoot);
  }

  const entries = await readdir(bundledSkillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    await options?.logger?.info("Loaded Kompass skill", {
      skill: entry.name,
      path: path.join(bundledSkillsRoot, entry.name),
    });
  }
}
