import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { applyAgentsConfig } from "../config.ts";

describe("applyAgentsConfig", () => {
  test("registers navigator with task and todowrite permission", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          prompt: string;
          permission: Record<string, string>;
        }
      >;
    } = {};

    await applyAgentsConfig(cfg as never, process.cwd());

    assert.ok(cfg.agent);
    assert.equal(
      cfg.agent.navigator?.description,
      "Coordinate todo and ship workflows by delegating work to subagents.",
    );
    assert.deepEqual(cfg.agent.navigator?.permission, {
      task: "allow",
      todowrite: "allow",
    });
    assert.match(cfg.agent.navigator?.prompt ?? "", /navigation specialist/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /delegate only explicit leaf tasks/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /complete the local steps first/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /todowrite/i);
  });
});
