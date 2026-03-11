import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface AgentDefinition {
  description: string;
  promptPath: string;
  permission: Record<string, string>;
}

export const DEFAULT_TOOL_NAMES = [
  "changes_load",
  "pr_load",
  "pr_review",
  "pr_sync",
  "ticket_sync",
  "ticket_load",
  "reload",
] as const;

export const DEFAULT_COMMAND_NAMES = [
  "commit",
  "commit-and-push",
  "dev",
  "learn",
  "pr/create",
  "pr/fix",
  "pr/review",
  "reload",
  "review",
  "ship",
  "rmslop",
  "todo",
  "ticket/create",
  "ticket/dev",
  "ticket/plan",
] as const;

export const DEFAULT_AGENT_NAMES = ["navigator", "planner", "reviewer"] as const;

export const DEFAULT_COMPONENT_NAMES = [
  "change-summary",
  "changes-summary",
  "commit",
  "dev-flow",
  "summarize-changes",
] as const;

export type ToolName = (typeof DEFAULT_TOOL_NAMES)[number];
export type CommandName = (typeof DEFAULT_COMMAND_NAMES)[number];
export type AgentName = (typeof DEFAULT_AGENT_NAMES)[number];
export type ComponentName = (typeof DEFAULT_COMPONENT_NAMES)[number];

export interface ToolConfig {
  enabled?: boolean;
  name?: string;
}

export interface ToggleConfig {
  enabled?: boolean;
}

export interface CommandConfig extends ToggleConfig {
  template?: string;
}

export interface AgentConfig extends ToggleConfig, Partial<AgentDefinition> {}

export interface ComponentConfig extends ToggleConfig {
  path?: string;
}

export interface SkillEntryConfig extends ToggleConfig {}

export interface SkillFilterConfig {
  enabled?: string[];
  disabled?: string[];
  entries?: Record<string, SkillEntryConfig>;
  plugins?: {
    include?: string[];
    exclude?: string[];
    entries?: Record<string, SkillEntryConfig>;
  };
}

export interface SkillIdentity {
  id: string;
  name: string;
  pluginId?: string;
}

export interface KompassConfig {
  commands?: {
    commit?: CommandConfig;
    "commit-and-push"?: CommandConfig;
    dev?: CommandConfig;
    learn?: CommandConfig;
    "pr/create"?: CommandConfig;
    "pr/fix"?: CommandConfig;
    "pr/review"?: CommandConfig;
    reload?: CommandConfig;
    review?: CommandConfig;
    ship?: CommandConfig;
    rmslop?: CommandConfig;
    todo?: CommandConfig;
    "ticket/create"?: CommandConfig;
    "ticket/dev"?: CommandConfig;
    "ticket/plan"?: CommandConfig;
    enabled?: string[];
    templates?: Record<string, string>;
  };
  agents?: {
    navigator?: AgentConfig;
    planner?: AgentConfig;
    reviewer?: AgentConfig;
    enabled?: string[];
  };
  tools?: {
    changes_load?: ToolConfig;
    pr_load?: ToolConfig;
    pr_review?: ToolConfig;
    pr_sync?: ToolConfig;
    ticket_sync?: ToolConfig;
    ticket_load?: ToolConfig;
    reload?: ToolConfig;
  };
  components?: {
    "change-summary"?: ComponentConfig;
    "changes-summary"?: ComponentConfig;
    commit?: ComponentConfig;
    "dev-flow"?: ComponentConfig;
    "summarize-changes"?: ComponentConfig;
    enabled?: string[];
    paths?: Record<string, string>;
  };
  skills?: SkillFilterConfig;
  defaults?: {
    baseBranch?: string;
    // Deprecated: prefer adapters.opencode.agentMode.
    agentMode?: "subagent" | "primary" | "all";
  };
  adapters?: {
    opencode?: {
      agentMode?: "subagent" | "primary" | "all";
    };
  };
}

export interface MergedKompassConfig {
  commands: {
    enabled: string[];
    templates: Record<string, string>;
  };
  agents: {
    enabled: string[];
    navigator: AgentDefinition;
    reviewer: AgentDefinition;
    planner: AgentDefinition;
  };
  tools: {
    changes_load: ToolConfig;
    pr_load: ToolConfig;
    pr_review: ToolConfig;
    pr_sync: ToolConfig;
    ticket_sync: ToolConfig;
    ticket_load: ToolConfig;
    reload: ToolConfig;
  };
  components: {
    enabled: string[];
    paths: Record<string, string>;
  };
  skills: {
    enabled: string[] | null;
    disabled: string[];
    plugins: {
      include: string[] | null;
      exclude: string[];
    };
  };
  defaults: {
    baseBranch: string;
  };
  adapters: {
    opencode: {
      agentMode: "subagent" | "primary" | "all";
    };
  };
}

const CONFIG_FILES = [
  ".opencode/kompass.jsonc",
  "kompass.jsonc",
  ".opencode/kompass.json",
  "kompass.json",
  ".compass/config.jsonc",
  ".compass/config.json",
  "compass.jsonc",
  "compass.json",
  ".opencode/compass.jsonc",
  ".opencode/compass.json",
  "opencode-compass.jsonc",
  "opencode-compass.json",
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadKompassConfig(
  projectRoot: string,
): Promise<KompassConfig | null> {
  for (const configFile of CONFIG_FILES) {
    const fullPath = path.resolve(projectRoot, configFile);
    if (await fileExists(fullPath)) {
      const content = await readFile(fullPath, "utf8");
      return parseJsonConfig(content, fullPath);
    }
  }
  return null;
}

function parseJsonConfig(content: string, filePath: string): KompassConfig {
  try {
    return JSON.parse(removeTrailingCommas(stripJsonComments(content))) as KompassConfig;
  } catch (error) {
    throw new Error(`Failed to parse Kompass config at ${filePath}`, { cause: error });
  }
}

function stripJsonComments(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let nextIndex = index + 1;
      while (nextIndex < input.length && /\s/.test(input[nextIndex])) {
        nextIndex += 1;
      }

      if (input[nextIndex] === "}" || input[nextIndex] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

const defaultAgentReviewer: AgentDefinition = {
  description: "Review diffs, PRs, and existing feedback without editing files.",
  promptPath: "agents/reviewer.txt",
  permission: { edit: "deny" },
};

const defaultAgentNavigator: AgentDefinition = {
  description: "Coordinate todo and ship workflows by delegating work to subagents.",
  promptPath: "agents/navigator.txt",
  permission: { task: "allow", todowrite: "allow" },
};

const defaultAgentPlanner: AgentDefinition = {
  description: "Turn requests or tickets into scoped implementation plans.",
  promptPath: "agents/planner.txt",
  permission: { edit: "deny" },
};

const defaultComponentPaths: Record<string, string> = {
  "change-summary": "components/change-summary.txt",
  "changes-summary": "components/changes-summary.txt",
  "commit": "components/commit.txt",
  "dev-flow": "components/dev-flow.txt",
  "summarize-changes": "components/summarize-changes.txt",
};

const defaultToolConfig: Record<ToolName, ToolConfig> = {
  changes_load: { enabled: true },
  pr_load: { enabled: true },
  pr_review: { enabled: true },
  pr_sync: { enabled: true },
  ticket_sync: { enabled: true },
  ticket_load: { enabled: true },
  reload: { enabled: true },
};

function getToggleEntry<T extends ToggleConfig>(
  group: Record<string, T | string[] | Record<string, string> | undefined> | undefined,
  name: string,
): T | undefined {
  const value = group?.[name];
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  if ("enabled" in value || "template" in value || "description" in value || "promptPath" in value || "permission" in value || "path" in value) {
    return value as T;
  }
  return value as T;
}

function getEnabledNames<TName extends string, TEntry extends ToggleConfig>(
  names: readonly TName[],
  group: Record<string, TEntry | string[] | Record<string, string> | undefined> | undefined,
  legacyEnabled: string[] | undefined,
  defaults: readonly TName[],
): TName[] {
  const legacyEnabledSet = legacyEnabled ? new Set(legacyEnabled) : null;
  const defaultEnabledSet = new Set(defaults);

  return names.filter((name) => {
    const entry = getToggleEntry<TEntry>(group, name);
    if (typeof entry?.enabled === "boolean") return entry.enabled;
    if (legacyEnabledSet) return legacyEnabledSet.has(name);
    return defaultEnabledSet.has(name);
  });
}

function getCommandTemplate(
  config: KompassConfig | null,
  name: CommandName,
): string | undefined {
  const entry = getToggleEntry<CommandConfig>(config?.commands, name);
  return entry?.template ?? config?.commands?.templates?.[name];
}

function getComponentPath(
  config: KompassConfig | null,
  name: ComponentName,
): string | undefined {
  const entry = getToggleEntry<ComponentConfig>(config?.components, name);
  return entry?.path ?? config?.components?.paths?.[name];
}

function getMergedSkillLists(config: KompassConfig | null): {
  enabled: string[] | null;
  disabled: string[];
  pluginInclude: string[] | null;
  pluginExclude: string[];
} {
  const skillEntries = config?.skills?.entries ?? {};
  const enabledEntries = Object.entries(skillEntries)
    .filter(([, value]) => value?.enabled !== false)
    .map(([name]) => name);
  const disabledEntries = Object.entries(skillEntries)
    .filter(([, value]) => value?.enabled === false)
    .map(([name]) => name);
  const pluginEntries = config?.skills?.plugins?.entries ?? {};
  const includedPlugins = Object.entries(pluginEntries)
    .filter(([, value]) => value?.enabled !== false)
    .map(([name]) => name);
  const excludedPlugins = Object.entries(pluginEntries)
    .filter(([, value]) => value?.enabled === false)
    .map(([name]) => name);

  const enabled = [...new Set([...(config?.skills?.enabled ?? []), ...enabledEntries])];
  const pluginInclude = [...new Set([...(config?.skills?.plugins?.include ?? []), ...includedPlugins])];

  return {
    enabled: enabled.length > 0 ? enabled : null,
    disabled: [...new Set([...(config?.skills?.disabled ?? []), ...disabledEntries])],
    pluginInclude: pluginInclude.length > 0 ? pluginInclude : null,
    pluginExclude: [...new Set([...(config?.skills?.plugins?.exclude ?? []), ...excludedPlugins])],
  };
}

export function getEnabledToolNames(tools: MergedKompassConfig["tools"]): ToolName[] {
  return DEFAULT_TOOL_NAMES.filter((toolName) => tools[toolName].enabled !== false);
}

export function getConfiguredToolName(
  tools: MergedKompassConfig["tools"],
  toolName: ToolName,
): string {
  return tools[toolName].name ?? toolName;
}

function normalizeSkillKey(value: string): string {
  return value.trim().toLowerCase();
}

export function isSkillEnabled(
  skills: MergedKompassConfig["skills"],
  skill: SkillIdentity,
): boolean {
  if (skill.pluginId) {
    const excludedPlugins = new Set(skills.plugins.exclude.map(normalizeSkillKey));
    if (excludedPlugins.has(normalizeSkillKey(skill.pluginId))) return false;

    if (skills.plugins.include) {
      const includedPlugins = new Set(skills.plugins.include.map(normalizeSkillKey));
      if (!includedPlugins.has(normalizeSkillKey(skill.pluginId))) return false;
    }
  }

  const disabled = new Set(skills.disabled.map(normalizeSkillKey));
  if (
    disabled.has(normalizeSkillKey(skill.id)) ||
    disabled.has(normalizeSkillKey(skill.name))
  ) {
    return false;
  }

  if (!skills.enabled) return true;

  const enabled = new Set(skills.enabled.map(normalizeSkillKey));
  return (
    enabled.has(normalizeSkillKey(skill.id)) ||
    enabled.has(normalizeSkillKey(skill.name))
  );
}

export function mergeWithDefaults(
  config: KompassConfig | null,
): MergedKompassConfig {
  const mergedSkills = getMergedSkillLists(config);
  const { enabled: _navigatorEnabled, ...navigatorOverrides } =
    config?.agents?.navigator ?? {};
  const { enabled: _reviewerEnabled, ...reviewerOverrides } = config?.agents?.reviewer ?? {};
  const { enabled: _plannerEnabled, ...plannerOverrides } = config?.agents?.planner ?? {};

  return {
    commands: {
      enabled: getEnabledNames(
        DEFAULT_COMMAND_NAMES,
        config?.commands,
        config?.commands?.enabled,
        DEFAULT_COMMAND_NAMES,
      ),
      templates: Object.fromEntries(
        DEFAULT_COMMAND_NAMES.flatMap((name) => {
          const template = getCommandTemplate(config, name);
          return template ? [[name, template]] : [];
        }),
      ),
    },
    agents: {
      enabled: getEnabledNames(
        DEFAULT_AGENT_NAMES,
        config?.agents,
        config?.agents?.enabled,
        DEFAULT_AGENT_NAMES,
      ),
      navigator: { ...defaultAgentNavigator, ...navigatorOverrides },
      reviewer: { ...defaultAgentReviewer, ...reviewerOverrides },
      planner: { ...defaultAgentPlanner, ...plannerOverrides },
    },
    tools: {
      changes_load: { ...defaultToolConfig.changes_load, ...config?.tools?.changes_load },
      pr_load: { ...defaultToolConfig.pr_load, ...config?.tools?.pr_load },
      pr_review: { ...defaultToolConfig.pr_review, ...config?.tools?.pr_review },
      pr_sync: { ...defaultToolConfig.pr_sync, ...config?.tools?.pr_sync },
      ticket_sync: { ...defaultToolConfig.ticket_sync, ...config?.tools?.ticket_sync },
      ticket_load: { ...defaultToolConfig.ticket_load, ...config?.tools?.ticket_load },
      reload: { ...defaultToolConfig.reload, ...config?.tools?.reload },
    },
    components: {
      enabled: getEnabledNames(
        DEFAULT_COMPONENT_NAMES,
        config?.components,
        config?.components?.enabled,
        DEFAULT_COMPONENT_NAMES,
      ),
      paths: Object.fromEntries(
        DEFAULT_COMPONENT_NAMES.map((name) => [
          name,
          getComponentPath(config, name) ?? defaultComponentPaths[name],
        ]),
      ),
    },
    skills: {
      enabled: mergedSkills.enabled,
      disabled: mergedSkills.disabled,
      plugins: {
        include: mergedSkills.pluginInclude,
        exclude: mergedSkills.pluginExclude,
      },
    },
    defaults: {
      baseBranch: config?.defaults?.baseBranch ?? "main",
    },
    adapters: {
      opencode: {
        agentMode:
          config?.adapters?.opencode?.agentMode ??
          config?.defaults?.agentMode ??
          "all",
      },
    },
  };
}
