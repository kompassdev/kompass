import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadResolvedAgents } from "../cache.ts";
import { applyAgentsConfig as applyAgentsTransform } from "../config.ts";

async function applyAgentsConfig(cfg: { agent?: Record<string, any> }, projectRoot: string) {
  cfg.agent ??= {};
  const draft = {
    update(name: string, update: (agent: Record<string, any>) => void) {
      const agent = cfg.agent![name] ?? { id: name, mode: "primary", permissions: [] };
      cfg.agent![name] = agent;
      update(agent);
    },
  };
  applyAgentsTransform(draft as never, await loadResolvedAgents(projectRoot));
}

process.env.HOME = path.join(os.tmpdir(), `kompass-test-home-${process.pid}-agents-config`);

describe("applyAgentsConfig", () => {
  test("registers agents with their default permissions", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          system?: string;
          permissions: Array<{ action: string; resource: string; effect: string }>;
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
    assert.deepEqual(cfg.agent.worker?.permissions.slice(-2), [
      { action: "question", resource: "*", effect: "allow" },
      { action: "todowrite", resource: "*", effect: "allow" },
    ]);
    assert.equal(cfg.agent.worker?.mode, "primary");
    assert.deepEqual(cfg.agent.reviewer?.permissions.slice(-3), [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "question", resource: "*", effect: "allow" },
      { action: "todowrite", resource: "*", effect: "allow" },
    ]);
    assert.deepEqual(cfg.agent.planner?.permissions.slice(-3), [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "question", resource: "*", effect: "allow" },
      { action: "todowrite", resource: "*", effect: "allow" },
    ]);
    assert.equal(cfg.agent.worker?.system, undefined);
    assert.equal(cfg.agent.navigator, undefined);
    assert.match(cfg.agent.reviewer?.system ?? "", /Never switch branches/i);
  });

  test("overwrites existing agent configuration", async () => {
    const cfg: {
      agent?: Record<
        string,
        {
          description: string;
          system?: string;
          permissions: Array<{ action: string; resource: string; effect: string }>;
          mode?: string;
        }
      >;
    } = {
      agent: {
        worker: {
          description: "Existing worker",
          system: "Existing prompt",
          permissions: [{ action: "question", resource: "*", effect: "deny" }],
        },
      },
    };

    await applyAgentsConfig(cfg as never, process.cwd());

    assert.equal(cfg.agent?.worker?.description, "Generic worker agent.");
    assert.equal(cfg.agent?.worker?.system, undefined);
    assert.deepEqual(cfg.agent?.worker?.permissions[0], {
      action: "question",
      resource: "*",
      effect: "deny",
    });
    assert.deepEqual(cfg.agent?.worker?.permissions.slice(-2), [
      { action: "question", resource: "*", effect: "allow" },
      { action: "todowrite", resource: "*", effect: "allow" },
    ]);
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
