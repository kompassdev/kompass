import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { applyAgentsConfig } from "../config.ts";

describe("applyAgentsConfig", () => {
  test("registers agents with their default permissions", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          prompt: string;
          permission: Record<string, string>;
          mode?: string;
        }
      >;
    } = {};

    await applyAgentsConfig(cfg as never, process.cwd());

    assert.ok(cfg.agent);
    assert.equal(
      cfg.agent.worker?.description,
      "Handle generic implementation work and ask targeted questions when needed.",
    );
    assert.deepEqual(cfg.agent.worker?.permission, {
      question: "allow",
    });
    assert.equal(cfg.agent.worker?.mode, "all");
    assert.equal(
      cfg.agent.navigator?.description,
      "Coordinate structured multi-step workflows by delegating focused leaf work to subagents.",
    );
    assert.deepEqual(cfg.agent.navigator?.permission, {
      edit: "deny",
      task: "allow",
      question: "allow",
    });
    assert.deepEqual(cfg.agent.reviewer?.permission, {
      edit: "deny",
      question: "allow",
    });
    assert.deepEqual(cfg.agent.planner?.permission, {
      edit: "deny",
      question: "allow",
    });
    assert.match(cfg.agent.worker?.prompt ?? "", /You are Worker\./i);
    assert.match(cfg.agent.worker?.prompt ?? "", /Ask a targeted question only when a missing detail truly blocks reliable execution/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /navigation specialist/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /delegate only explicit leaf tasks/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /complete the local steps first/i);
    assert.match(cfg.agent.reviewer?.prompt ?? "", /Never switch branches/i);
  });
});
