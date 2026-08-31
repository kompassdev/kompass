import { OpenCodeCompassPluginV1 } from "./v1.ts";
import {
  OpenCodeCompassPluginV2,
  setupOpenCodeV2,
} from "./v2.ts";

export const OpenCodeCompassPlugin = {
  id: "kompass",
  server: OpenCodeCompassPluginV1,
  setup: setupOpenCodeV2,
};

export {
  OpenCodeCompassPluginV1,
  OpenCodeCompassPluginV2,
  setupOpenCodeV2,
};
export {
  applyAgentsConfig,
  applyCommandsConfig,
  createOpenCodeTools,
  getCommandExecution,
} from "./v1.ts";
export default OpenCodeCompassPlugin;
