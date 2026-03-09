import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface AgentDefinition {
  description: string;
  promptPath: string;
  permission: Record<string, string>;
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
    enabled?: string[];
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
    enabled: string[];
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
};

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
      enabled: config?.tools?.enabled ?? [
        "changes_load",
        "pr_load",
        "ticket_create",
        "ticket_load",
      ],
    },
    components: {
      enabled: config?.components?.enabled ?? [
        "change-summary",
        "commit",
        "dev-flow",
        "summarize-changes",
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
