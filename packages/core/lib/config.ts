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

export type ToolName = (typeof DEFAULT_TOOL_NAMES)[number];

export interface ToolConfig {
  enabled?: boolean;
  name?: string;
}

export interface KompassConfig {
  commands?: {
    enabled?: string[];
    templates?: Record<string, string>;
  };
  agents?: {
    enabled?: string[];
    reviewer?: Partial<AgentDefinition>;
    planner?: Partial<AgentDefinition>;
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
  ".opencode/kompass.json",
  "kompass.json",
  ".compass/config.json",
  "compass.json",
  ".opencode/compass.json",
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
      return JSON.parse(content) as KompassConfig;
    }
  }
  return null;
}

const defaultAgentReviewer: AgentDefinition = {
  description: "Review diffs, PRs, and existing feedback without editing files.",
  promptPath: "agents/reviewer.txt",
  permission: { edit: "deny" },
};

const defaultAgentPlanner: AgentDefinition = {
  description: "Turn requests or tickets into scoped implementation plans.",
  promptPath: "agents/planner.txt",
  permission: { edit: "deny" },
};

const defaultComponentPaths: Record<string, string> = {
  "change-summary": "components/change-summary.txt",
  "commit": "components/commit.txt",
  "dev-flow": "components/dev-flow.txt",
  "summarize-changes": "components/summarize-changes.txt",
  "ticket-summary": "components/ticket-summary.txt",
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

export function getEnabledToolNames(tools: MergedKompassConfig["tools"]): ToolName[] {
  return DEFAULT_TOOL_NAMES.filter((toolName) => tools[toolName].enabled !== false);
}

export function getConfiguredToolName(
  tools: MergedKompassConfig["tools"],
  toolName: ToolName,
): string {
  return tools[toolName].name ?? toolName;
}

export function mergeWithDefaults(
  config: KompassConfig | null,
): MergedKompassConfig {
  return {
    commands: {
      enabled: config?.commands?.enabled ?? [
        "commit",
        "commit-and-push",
        "dev",
        "learn",
        "pr/create",
        "pr/fix",
        "pr/review",
        "reload",
        "review",
        "rmslop",
        "ticket/create",
        "ticket/dev",
        "ticket/plan",
      ],
      templates: config?.commands?.templates ?? {},
    },
    agents: {
      enabled: config?.agents?.enabled ?? ["planner", "reviewer"],
      reviewer: { ...defaultAgentReviewer, ...config?.agents?.reviewer },
      planner: { ...defaultAgentPlanner, ...config?.agents?.planner },
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
      enabled: config?.components?.enabled ?? [
        "change-summary",
        "commit",
        "dev-flow",
        "summarize-changes",
        "ticket-summary",
      ],
      paths: { ...defaultComponentPaths, ...config?.components?.paths },
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
