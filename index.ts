import { applyAgentsConfig } from "./agents/index.ts";
import { applyCommandsConfig } from "./commands/index.ts";
import { skillsDir } from "./lib/paths.ts";
import { createTools } from "./tools/index.ts";

export const OpencodeCompassPlugin = async ({ $ }: { $: any }) => {
  return {
    tool: createTools($),
    async config(cfg: any) {
      cfg.skills ??= {};
      cfg.skills.paths = [...new Set([...(cfg.skills.paths ?? []), skillsDir])];

      await applyAgentsConfig(cfg);
      await applyCommandsConfig(cfg);
    },
  };
};

export default OpencodeCompassPlugin;
