import type { Plugin, PluginInput } from "@opencode-ai/plugin";

import { applyAgentsConfig } from "./agents/index.ts";
import { applyCommandsConfig } from "./commands/index.ts";
import { createTools } from "./tools/index.ts";

const OpencodeCompassPlugin: Plugin = async ({ $ }: PluginInput) => {
  return {
    tool: createTools($),
    async config(cfg) {
      await applyAgentsConfig(cfg);
      await applyCommandsConfig(cfg);
    },
  };
};

export { OpencodeCompassPlugin };
export default OpencodeCompassPlugin;
