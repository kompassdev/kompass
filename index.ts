import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import type { Config } from "@opencode-ai/sdk";

import { applyAgentsConfig } from "./agents/index.ts";
import { applyCommandsConfig } from "./commands/index.ts";
import { createTools } from "./tools/index.ts";

const OpencodeCompassPlugin: Plugin = async ({ $, worktree }: PluginInput) => {
  return {
    tool: await createTools($, worktree),
    async config(cfg: Config) {
      await applyAgentsConfig(cfg, worktree);
      await applyCommandsConfig(cfg, worktree);
    },
  };
};

export { OpencodeCompassPlugin };
export default OpencodeCompassPlugin;
