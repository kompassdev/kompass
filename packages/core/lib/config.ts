import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AgentDefinition {
  name?: string;
  description: string;
  promptPath?: string;
  permission: Record<string, string>;
  mode?: "subagent" | "primary" | "all";
}

export const DEFAULT_TOOL_NAMES = [
  "changes_load",
  "pr_load",
  "pr_load_review",
  "pr_sync",
  "ticket_sync",
  "ticket_load",
  "worktree_list",
  "session_create",
  "session_list",
  "session_read",
  "session_send",
  "session_wait",
  "session_interrupt",
  "worktree_remove",
] as const;

export const NAVIGATOR_TOOL_NAMES = [
  "worktree_list",
  "session_create",
  "session_list",
  "session_read",
  "session_send",
  "session_wait",
  "session_interrupt",
  "worktree_remove",
] as const;

export const DEFAULT_COMMAND_NAMES = [
  "ask",
  "branch",
  "branch/inline",
  "commit",
  "commit/inline",
  "commit-and-push",
  "commit-and-push/inline",
  "dev",
  "learn",
  "merge",
  "pr/create",
  "pr/create/inline",
  "pr/fix",
  "pr/fix/loop",
  "pr/review",
  "review",
  "skill/create",
  "skill/optimize",
  "ship",
  "ship/inline",
  "rmslop",
  "todo",
  "ticket/ask",
  "ticket/create",
  "ticket/dev",
  "ticket/plan",
  "ticket/plan-and-sync",
] as const;

export const DEFAULT_AGENT_NAMES = ["worker", "planner", "reviewer"] as const;

export const DEFAULT_COMPONENT_NAMES = [
  "change-summary",
  "branch",
  "changes-summary",
  "commit",
  "dev-flow",
  "load-pr",
  "load-ticket",
  "pr-create",
  "pr-branch-update",
  "pr-fix",
  "push",
  "skill-authoring",
  "ticket-planning",
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
  name?: string;
  template?: string;
  [key: string]: unknown;
}

export interface AgentConfig extends ToggleConfig, Partial<AgentDefinition> {}

export interface ComponentConfig extends ToggleConfig {
  path?: string;
}

export interface KompassConfig {
  shared?: {
    prApprove?: boolean;
    validation?: string[];
  };
  commands?: {
    ask?: CommandConfig;
    branch?: CommandConfig;
    "branch/inline"?: CommandConfig;
    commit?: CommandConfig;
    "commit/inline"?: CommandConfig;
    "commit-and-push"?: CommandConfig;
    "commit-and-push/inline"?: CommandConfig;
    dev?: CommandConfig;
    learn?: CommandConfig;
    merge?: CommandConfig;
    "pr/create"?: CommandConfig;
    "pr/create/inline"?: CommandConfig;
    "pr/fix"?: CommandConfig;
    "pr/fix/loop"?: CommandConfig;
    "pr/review"?: CommandConfig;
    review?: CommandConfig;
    "skill/create"?: CommandConfig;
    "skill/optimize"?: CommandConfig;
    ship?: CommandConfig;
    "ship/inline"?: CommandConfig;
    rmslop?: CommandConfig;
    todo?: CommandConfig;
    "ticket/ask"?: CommandConfig;
    "ticket/create"?: CommandConfig;
    "ticket/dev"?: CommandConfig;
    "ticket/plan"?: CommandConfig;
    "ticket/plan-and-sync"?: CommandConfig;
    enabled?: string[];
    templates?: Record<string, string>;
  };
  agents?: {
    worker?: AgentConfig;
    planner?: AgentConfig;
    reviewer?: AgentConfig;
    enabled?: string[];
  };
  tools?: {
    changes_load?: ToolConfig;
    pr_load?: ToolConfig;
    pr_load_review?: ToolConfig;
    pr_sync?: ToolConfig;
    ticket_sync?: ToolConfig;
    ticket_load?: ToolConfig;
    worktree_list?: ToolConfig;
    session_create?: ToolConfig;
    session_list?: ToolConfig;
    session_read?: ToolConfig;
    session_send?: ToolConfig;
    session_wait?: ToolConfig;
    session_interrupt?: ToolConfig;
    worktree_remove?: ToolConfig;
  };
  components?: {
    "change-summary"?: ComponentConfig;
    branch?: ComponentConfig;
    "changes-summary"?: ComponentConfig;
    commit?: ComponentConfig;
    "dev-flow"?: ComponentConfig;
    "load-pr"?: ComponentConfig;
    "load-ticket"?: ComponentConfig;
    "pr-create"?: ComponentConfig;
    "pr-branch-update"?: ComponentConfig;
    "pr-fix"?: ComponentConfig;
    push?: ComponentConfig;
    "skill-authoring"?: ComponentConfig;
    "ticket-planning"?: ComponentConfig;
    enabled?: string[];
    paths?: Record<string, string>;
  };
  defaults?: {
    baseBranch?: string;
    // Deprecated: prefer adapters.opencode.agentMode.
    agentMode?: "subagent" | "primary" | "all";
  };
  adapters?: {
    opencode?: {
      agentMode?: "subagent" | "primary" | "all";
      navigator?: Partial<NavigatorConfig>;
    };
  };
}

export interface MergedKompassConfig {
  shared: {
    prApprove: boolean;
    validation: string[];
  };
  commands: {
    enabled: string[];
    templates: Record<string, string>;
    entries: Record<string, CommandConfig>;
  };
  agents: {
    worker: AgentDefinition;
    enabled: string[];
    reviewer: AgentDefinition;
    planner: AgentDefinition;
  };
  tools: {
    changes_load: ToolConfig;
    pr_load: ToolConfig;
    pr_load_review: ToolConfig;
    pr_sync: ToolConfig;
    ticket_sync: ToolConfig;
    ticket_load: ToolConfig;
    worktree_list: ToolConfig;
    session_create: ToolConfig;
    session_list: ToolConfig;
    session_read: ToolConfig;
    session_send: ToolConfig;
    session_wait: ToolConfig;
    session_interrupt: ToolConfig;
    worktree_remove: ToolConfig;
  };
  components: {
    enabled: string[];
    paths: Record<string, string>;
  };
  defaults: {
    baseBranch: string;
  };
  adapters: {
    opencode: {
      agentMode: "subagent" | "primary" | "all";
      navigator: NavigatorConfig;
    };
  };
}

export interface NavigatorConfig {
  enabled: boolean;
  maxConcurrentSessions: number;
  maxReadChars: number;
  maxOutputCharsPerItem: number;
  maxWaitMs: number;
}

const BUNDLED_CONFIG_CANDIDATES = [path.resolve(__dirname, "..", "kompass.jsonc")] as const;

const PROJECT_CONFIG_FILES = [
  ".opencode/kompass.jsonc",
  ".opencode/kompass.json",
  "kompass.jsonc",
  "kompass.json",
] as const;

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
): Promise<KompassConfig> {
  const bundledConfig = await loadBundledConfig();
  const configRoots = getConfigRoots(projectRoot);

  let mergedConfig: KompassConfig | null = bundledConfig;
  for (const configRoot of configRoots) {
    mergedConfig = mergeConfigObjects(
      mergedConfig,
      await loadFirstConfig(configRoot, PROJECT_CONFIG_FILES),
    );
  }

  return mergedConfig ?? bundledConfig;
}

function getConfigRoots(projectRoot: string): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();

  const homeDirectory = process.env.HOME || os.homedir();
  if (homeDirectory) {
    const normalizedHome = path.resolve(homeDirectory);
    seen.add(normalizedHome);
    roots.push(normalizedHome);
  }

  const normalizedProjectRoot = path.resolve(projectRoot);
  if (!seen.has(normalizedProjectRoot)) {
    roots.push(normalizedProjectRoot);
  }

  return roots;
}

async function loadBundledConfig(): Promise<KompassConfig> {
  for (const candidate of BUNDLED_CONFIG_CANDIDATES) {
    if (await fileExists(candidate)) {
      const content = await readFile(candidate, "utf8");
      return parseJsonConfig(content, candidate);
    }
  }

  throw new Error(
    `Failed to locate bundled Kompass config. Checked: ${BUNDLED_CONFIG_CANDIDATES.join(", ")}`,
  );
}

async function loadFirstConfig(
  projectRoot: string,
  configFiles: readonly string[],
): Promise<KompassConfig | null> {
  for (const configFile of configFiles) {
    const fullPath = path.resolve(projectRoot, configFile);
    if (await fileExists(fullPath)) {
      const content = await readFile(fullPath, "utf8");
      return parseJsonConfig(content, fullPath);
    }
  }

  return null;
}

function mergeConfigObjects(
  base: KompassConfig | null,
  override: KompassConfig | null,
): KompassConfig | null {
  if (base === null) return override;
  if (override === null) return base;

  return mergeUnknown(base, override) as KompassConfig;
}

function mergeUnknown(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (base === undefined) return override;
  if (Array.isArray(base) || Array.isArray(override)) {
    return override;
  }
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in merged ? mergeUnknown(merged[key], value) : value;
  }

  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

const defaultAgentWorker: AgentDefinition = {
  description: "Generic worker agent.",
  permission: { question: "allow", todowrite: "allow" },
};

const defaultAgentReviewer: AgentDefinition = {
  description: "Review diffs, PRs, and existing feedback without editing files.",
  promptPath: "agents/reviewer.md",
  permission: { edit: "deny", question: "allow", todowrite: "allow" },
};

const defaultAgentPlanner: AgentDefinition = {
  description: "Turn requests or tickets into scoped implementation plans.",
  promptPath: "agents/planner.md",
  permission: { edit: "deny", question: "allow", todowrite: "allow" },
};

const defaultComponentPaths: Record<string, string> = {
  "change-summary": "components/change-summary.md",
  branch: "components/branch.md",
  "changes-summary": "components/changes-summary.md",
  "commit": "components/commit.md",
  "dev-flow": "components/dev-flow.md",
  "load-pr": "components/load-pr.md",
  "load-ticket": "components/load-ticket.md",
  "pr-create": "components/pr-create.md",
  "pr-branch-update": "components/pr-branch-update.md",
  "pr-fix": "components/pr-fix.md",
  push: "components/push.md",
  "skill-authoring": "components/skill-authoring.md",
  "ticket-planning": "components/ticket-planning.md",
};

const defaultToolConfig: Record<ToolName, ToolConfig> = {
  changes_load: { enabled: true },
  pr_load: { enabled: true },
  pr_load_review: { enabled: true },
  pr_sync: { enabled: true },
  ticket_sync: { enabled: true },
  ticket_load: { enabled: true },
  worktree_list: { enabled: true },
  session_create: { enabled: true },
  session_list: { enabled: true },
  session_read: { enabled: true },
  session_send: { enabled: true },
  session_wait: { enabled: true },
  session_interrupt: { enabled: true },
  worktree_remove: { enabled: true },
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

function getCommandEntry(
  config: KompassConfig | null,
  name: CommandName,
): CommandConfig | undefined {
  return getToggleEntry<CommandConfig>(config?.commands, name);
}

function getComponentPath(
  config: KompassConfig | null,
  name: ComponentName,
): string | undefined {
  const entry = getToggleEntry<ComponentConfig>(config?.components, name);
  return entry?.path ?? config?.components?.paths?.[name];
}

export function getEnabledToolNames(
  tools: MergedKompassConfig["tools"],
  navigatorEnabled = false,
): ToolName[] {
  const navigatorTools = new Set<string>(NAVIGATOR_TOOL_NAMES);
  return DEFAULT_TOOL_NAMES.filter((toolName) =>
    tools[toolName].enabled !== false && (navigatorEnabled || !navigatorTools.has(toolName))
  );
}

export function getConfiguredToolName(
  tools: MergedKompassConfig["tools"],
  toolName: ToolName,
): string {
  return tools[toolName].name ?? toolName;
}

export function getConfiguredToolNames(
  tools: MergedKompassConfig["tools"],
): Record<ToolName, { name: string }> {
  return Object.fromEntries(
    DEFAULT_TOOL_NAMES.map((toolName) => [toolName, { name: getConfiguredToolName(tools, toolName) }]),
  ) as Record<ToolName, { name: string }>;
}

export function getConfiguredCommandNames(
  commands: MergedKompassConfig["commands"],
): Record<CommandName, { name: string }> {
  return Object.fromEntries(
    DEFAULT_COMMAND_NAMES.map((commandName) => [
      commandName,
      { name: commands.entries[commandName]?.name ?? commandName },
    ]),
  ) as Record<CommandName, { name: string }>;
}

export function getConfiguredAgentNames(
  agents: MergedKompassConfig["agents"],
): Record<AgentName, { name: string }> {
  return Object.fromEntries(
    DEFAULT_AGENT_NAMES.map((agentName) => [
      agentName,
      { name: agents[agentName].name ?? agentName },
    ]),
  ) as Record<AgentName, { name: string }>;
}

export function mergeWithDefaults(
  config: KompassConfig | null,
): MergedKompassConfig {
  const { enabled: _workerEnabled, ...workerOverrides } = config?.agents?.worker ?? {};
  const { enabled: _reviewerEnabled, ...reviewerOverrides } = config?.agents?.reviewer ?? {};
  const { enabled: _plannerEnabled, ...plannerOverrides } = config?.agents?.planner ?? {};
  const navigator = {
    enabled: config?.adapters?.opencode?.navigator?.enabled ?? true,
    maxConcurrentSessions:
      config?.adapters?.opencode?.navigator?.maxConcurrentSessions ?? 8,
    maxReadChars: config?.adapters?.opencode?.navigator?.maxReadChars ?? 20_000,
    maxOutputCharsPerItem:
      config?.adapters?.opencode?.navigator?.maxOutputCharsPerItem ?? 4_000,
    maxWaitMs: config?.adapters?.opencode?.navigator?.maxWaitMs ?? 120_000,
  };

  for (const [name, value] of Object.entries(navigator).filter(([name]) => name !== "enabled") as Array<[string, number]>) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`adapters.opencode.navigator.${name} must be a positive integer`);
    }
  }
  if (navigator.maxConcurrentSessions > 8) {
    throw new Error("adapters.opencode.navigator.maxConcurrentSessions cannot exceed 8");
  }
  if (navigator.maxOutputCharsPerItem > navigator.maxReadChars) {
    throw new Error("adapters.opencode.navigator.maxOutputCharsPerItem cannot exceed maxReadChars");
  }

  return {
    shared: {
      prApprove: config?.shared?.prApprove ?? false,
      validation: config?.shared?.validation ?? [],
    },
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
      entries: Object.fromEntries(
        DEFAULT_COMMAND_NAMES.flatMap((name) => {
          const entry = getCommandEntry(config, name);
          return entry ? [[name, entry]] : [];
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
      worker: { ...defaultAgentWorker, ...workerOverrides },
      reviewer: { ...defaultAgentReviewer, ...reviewerOverrides },
      planner: { ...defaultAgentPlanner, ...plannerOverrides },
    },
    tools: {
      changes_load: { ...defaultToolConfig.changes_load, ...config?.tools?.changes_load },
      pr_load: { ...defaultToolConfig.pr_load, ...config?.tools?.pr_load },
      pr_load_review: {
        ...defaultToolConfig.pr_load_review,
        ...config?.tools?.pr_load_review,
      },
      pr_sync: { ...defaultToolConfig.pr_sync, ...config?.tools?.pr_sync },
      ticket_sync: { ...defaultToolConfig.ticket_sync, ...config?.tools?.ticket_sync },
      ticket_load: { ...defaultToolConfig.ticket_load, ...config?.tools?.ticket_load },
      worktree_list: { ...defaultToolConfig.worktree_list, ...config?.tools?.worktree_list },
      session_create: { ...defaultToolConfig.session_create, ...config?.tools?.session_create },
      session_list: { ...defaultToolConfig.session_list, ...config?.tools?.session_list },
      session_read: { ...defaultToolConfig.session_read, ...config?.tools?.session_read },
      session_send: { ...defaultToolConfig.session_send, ...config?.tools?.session_send },
      session_wait: { ...defaultToolConfig.session_wait, ...config?.tools?.session_wait },
      session_interrupt: { ...defaultToolConfig.session_interrupt, ...config?.tools?.session_interrupt },
      worktree_remove: { ...defaultToolConfig.worktree_remove, ...config?.tools?.worktree_remove },
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
    defaults: {
      baseBranch: config?.defaults?.baseBranch ?? "main",
    },
    adapters: {
      opencode: {
        agentMode:
          config?.adapters?.opencode?.agentMode ??
          config?.defaults?.agentMode ??
          "all",
        navigator,
      },
    },
  };
}
