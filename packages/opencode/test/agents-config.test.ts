import { describe, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { applyAgentsConfig } from "../config.ts";

process.env.HOME = path.join(os.tmpdir(), `kompass-test-home-${process.pid}-agents-config`);

describe("applyAgentsConfig", () => {
  test("registers agents with their default permissions", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          prompt?: string;
          permission: Record<string, string>;
          mode?: string;
        }
      >;
    } = {};

    await applyAgentsConfig(cfg as never, process.cwd());

    assert.ok(cfg.agent);
    assert.equal(
      cfg.agent.worker?.description,
      "Generic worker agent.",
    );
    assert.deepEqual(cfg.agent.worker?.permission, {
      question: "allow",
      todowrite: "allow",
    });
    assert.equal(cfg.agent.worker?.mode, undefined);
    assert.equal(
      cfg.agent.navigator?.description,
      "Coordinate structured multi-step workflows by delegating focused leaf work to subagents.",
    );
    assert.deepEqual(cfg.agent.navigator?.permission, {
      edit: "deny",
      task: "allow",
      question: "allow",
      todowrite: "allow",
    });
    assert.deepEqual(cfg.agent.reviewer?.permission, {
      edit: "deny",
      question: "allow",
      todowrite: "allow",
    });
    assert.deepEqual(cfg.agent.planner?.permission, {
      edit: "deny",
      question: "allow",
      todowrite: "allow",
    });
    assert.equal(cfg.agent.worker?.prompt, undefined);
    assert.match(cfg.agent.navigator?.prompt ?? "", /orchestrator/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /do not do implementation, planning, or review work yourself/i);
    assert.match(cfg.agent.navigator?.prompt ?? "", /do not look up command documentation/i);
    assert.match(cfg.agent.reviewer?.prompt ?? "", /Never switch branches/i);
  });

  test("overwrites existing agent configuration", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          prompt?: string;
          permission: Record<string, string>;
          mode?: string;
        }
      >;
    } = {
      agent: {
        worker: {
          description: "Existing worker",
          prompt: "Existing prompt",
          permission: { question: "deny" },
        },
      },
    };

    await applyAgentsConfig(cfg as never, process.cwd());

    assert.equal(cfg.agent?.worker?.description, "Generic worker agent.");
    assert.equal(cfg.agent?.worker?.prompt, undefined);
    assert.deepEqual(cfg.agent?.worker?.permission, {
      question: "allow",
      todowrite: "allow",
    });
  });
});
