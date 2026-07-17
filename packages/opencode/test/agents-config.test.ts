import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    assert.equal(cfg.agent.navigator, undefined);
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

  test("registers configured agent aliases", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-agent-alias-"));

    try {
      await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
      await writeFile(
        path.join(tempDir, ".opencode", "kompass.jsonc"),
        `{
          "agents": {
            "reviewer": {
              "enabled": true,
              "name": "code-reviewer"
            }
          }
        }`,
      );

      const cfg: { agent?: Record<string, { description: string }> } = {};

      await applyAgentsConfig(cfg as never, tempDir);

      assert.ok(cfg.agent?.["code-reviewer"]);
      assert.equal(cfg.agent?.reviewer, undefined);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
