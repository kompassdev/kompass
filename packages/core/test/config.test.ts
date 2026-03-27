import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadKompassConfig, mergeWithDefaults } from "../lib/config.ts";

const originalHome = process.env.HOME;

async function withTempHome<T>(run: (homeDir: string) => Promise<T>): Promise<T> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "kompass-home-"));

  process.env.HOME = homeDir;

  try {
    return await run(homeDir);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
}

describe("config loading", () => {
  test("parses .opencode jsonc config files", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            // jsonc should be supported
            "commands": {
              "dev": {
                "enabled": false,
              },
            },
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(config?.commands?.dev?.enabled, false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("parses validation strings in jsonc config files", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-validation-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "validation": [
                "Run lint if available",
                "Run tests if available"
              ]
            }
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(
          JSON.stringify(config.shared?.validation),
          JSON.stringify(["Run lint if available", "Run tests if available"]),
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("prefers project config files in documented order", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-order-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.json"),
          JSON.stringify({ shared: { prApprove: false } }),
        );
        await writeFile(
          path.join(tempDir, "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": false
            },
            "commands": {
              "dev": {
                "enabled": false
              }
            }
          }`,
        );
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true
            }
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(config.shared?.prApprove, true);
        assert.equal(config.commands?.dev?.enabled, true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("merges bundled config with .opencode overrides", async () => {
    await withTempHome(async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-merge-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true
            },
            "commands": {
              "dev": {
                "enabled": false
              }
            }
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(config?.shared?.prApprove, true);
        assert.equal(config?.defaults?.baseBranch, "main");
        assert.equal(config?.commands?.dev?.enabled, false);
        assert.equal(config?.commands?.review?.enabled, true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("falls back to home config when project has no override", async () => {
    await withTempHome(async (homeDir) => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-home-fallback-"));

      try {
        await mkdir(path.join(homeDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(homeDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true
            },
            "commands": {
              "dev": {
                "enabled": false
              }
            }
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(config.shared?.prApprove, true);
        assert.equal(config.commands?.dev?.enabled, false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  test("project config overrides home config", async () => {
    await withTempHome(async (homeDir) => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-home-override-"));

      try {
        await mkdir(path.join(homeDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(homeDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": false
            },
            "commands": {
              "dev": {
                "enabled": false
              }
            }
          }`,
        );

        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": true
            }
          }`,
        );

        const config = await loadKompassConfig(tempDir);

        assert.equal(config.shared?.prApprove, true);
        assert.equal(config.commands?.dev?.enabled, false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

describe("object-based config", () => {
  test("supports command, agent, and component entry toggles", () => {
    const config = mergeWithDefaults({
      shared: {
        prApprove: false,
        validation: ["Run custom validation"],
      },
      commands: {
        dev: { enabled: false },
        review: { enabled: true, template: "commands/custom-review.md" },
      },
      agents: {
        worker: { permission: { question: "deny", bash: "allow" } },
        navigator: { permission: { task: "deny", todowrite: "deny" } },
        reviewer: { enabled: false },
      },
      components: {
        "dev-flow": { enabled: false },
        commit: { path: "components/custom-commit.md" },
      },
    });

    assert.equal(config.commands.enabled.includes("dev"), false);
    assert.equal(config.commands.enabled.includes("review"), true);
    assert.equal(config.commands.templates.review, "commands/custom-review.md");
    assert.equal(config.shared.prApprove, false);
    assert.deepEqual(config.shared.validation, ["Run custom validation"]);
    assert.deepEqual(config.agents.worker.permission, {
      question: "deny",
      bash: "allow",
    });
    assert.deepEqual(config.agents.navigator.permission, {
      task: "deny",
      todowrite: "deny",
    });
    assert.equal(config.agents.enabled.includes("reviewer"), false);
    assert.equal(config.components.enabled.includes("dev-flow"), false);
    assert.equal(config.components.paths.commit, "components/custom-commit.md");
  });
});

describe("command defaults", () => {
  test("enables worker and navigator agents by default", () => {
    const config = mergeWithDefaults(null);

    assert.equal(config.agents.enabled.includes("worker"), true);
    assert.deepEqual(config.agents.worker.permission, {
      question: "allow",
    });
    assert.equal(config.agents.enabled.includes("navigator"), true);
    assert.deepEqual(config.shared.validation, []);
    assert.deepEqual(config.agents.navigator.permission, {
      edit: "deny",
      task: "allow",
      question: "allow",
    });
  });

  test("enables todo command by default", () => {
    const config = mergeWithDefaults(null);

    assert.equal(config.commands.enabled.includes("todo"), true);
  });
});
