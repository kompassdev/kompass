import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface AgentDefinition {
  description: string;
  promptPath: string;
  permission: Record<string, string>;
}

export interface CompassConfig {
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
    agentMode?: "subagent" | "primary" | "all";
  };
}

export interface MergedCompassConfig {
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
    agentMode: "subagent" | "primary" | "all";
  };
}

const CONFIG_FILES = [
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

export async function loadCompassConfig(
  projectRoot: string,
): Promise<CompassConfig | null> {
  for (const configFile of CONFIG_FILES) {
    const fullPath = path.resolve(projectRoot, configFile);
    if (await fileExists(fullPath)) {
      const content = await readFile(fullPath, "utf8");
      return JSON.parse(content) as CompassConfig;
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
  "pr-author": "components/pr-author.txt",
  "dev-flow": "components/dev-flow.txt",
  "ticket-plan": "components/ticket-plan.txt",
  "pr-fix": "components/pr-fix.txt",
  "pr-review": "components/pr-review.txt",
};

export function mergeWithDefaults(
  config: CompassConfig | null,
): MergedCompassConfig {
  return {
    commands: {
      enabled: config?.commands?.enabled ?? [
        "pr/create",
        "pr/review",
        "pr/fix",
        "ticket/plan",
        "ticket/dev",
        "review",
        "dev",
      ],
      templates: config?.commands?.templates ?? {},
    },
    agents: {
      enabled: config?.agents?.enabled ?? ["reviewer", "planner"],
      reviewer: { ...defaultAgentReviewer, ...config?.agents?.reviewer },
      planner: { ...defaultAgentPlanner, ...config?.agents?.planner },
    },
    tools: {
      enabled: config?.tools?.enabled ?? [
        "changes_load",
        "pr_load",
        "ticket_load",
        "ticket_create",
      ],
    },
    components: {
      enabled: config?.components?.enabled ?? [
        "pr-author",
        "dev-flow",
        "ticket-plan",
        "pr-fix",
        "pr-review",
      ],
      paths: { ...defaultComponentPaths, ...config?.components?.paths },
    },
    defaults: {
      baseBranch: config?.defaults?.baseBranch ?? "main",
      agentMode: config?.defaults?.agentMode ?? "subagent",
    },
  };
}
