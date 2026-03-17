import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isSkillEnabled, loadKompassConfig, mergeWithDefaults } from "../lib/config.ts";

describe("config loading", () => {
  test("parses .opencode jsonc config files", async () => {
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

  test("prefers project config files in documented order", async () => {
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

  test("merges bundled config with .opencode overrides", async () => {
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

describe("object-based config", () => {
  test("supports command, agent, and component entry toggles", () => {
    const config = mergeWithDefaults({
      shared: { prApprove: false },
      commands: {
        dev: { enabled: false },
        review: { enabled: true, template: "commands/custom-review.md" },
      },
      agents: {
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
    assert.deepEqual(config.agents.navigator.permission, {
      task: "deny",
      todowrite: "deny",
    });
    assert.equal(config.agents.enabled.includes("reviewer"), false);
    assert.equal(config.components.enabled.includes("dev-flow"), false);
    assert.equal(config.components.paths.commit, "components/custom-commit.md");
  });

  test("supports skill entry maps", () => {
    const config = mergeWithDefaults({
      skills: {
        entries: {
          "release-checklist": { enabled: true },
          "legacy-release-flow": { enabled: false },
        },
        plugins: {
          entries: {
            "@acme/opencode-release": { enabled: true },
            "@acme/opencode-experimental": { enabled: false },
          },
        },
      },
    });

    assert.deepEqual(config.skills.enabled, ["release-checklist"]);
    assert.deepEqual(config.skills.disabled, ["legacy-release-flow"]);
    assert.deepEqual(config.skills.plugins.include, ["@acme/opencode-release"]);
    assert.deepEqual(config.skills.plugins.exclude, ["@acme/opencode-experimental"]);
  });
});

describe("command defaults", () => {
  test("enables navigator agent by default", () => {
    const config = mergeWithDefaults(null);

    assert.equal(config.agents.enabled.includes("navigator"), true);
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

describe("skills config", () => {
  test("defaults to all skills enabled when no allowlist is configured", () => {
    const config = mergeWithDefaults(null);

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-release",
      }),
      true,
    );
  });

  test("allows a skill by short name", () => {
    const config = mergeWithDefaults({
      skills: {
        enabled: ["release-checklist"],
      },
    });

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-release",
      }),
      true,
    );
    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/hotfix-triage",
        name: "hotfix-triage",
        pluginId: "@acme/opencode-release",
      }),
      false,
    );
  });

  test("allows a skill by fully-qualified id", () => {
    const config = mergeWithDefaults({
      skills: {
        enabled: ["@acme/opencode-release/hotfix-triage"],
      },
    });

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/hotfix-triage",
        name: "hotfix-triage",
        pluginId: "@acme/opencode-release",
      }),
      true,
    );
  });

  test("disabled takes precedence over enabled", () => {
    const config = mergeWithDefaults({
      skills: {
        enabled: ["release-checklist"],
        disabled: ["release-checklist"],
      },
    });

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-release",
      }),
      false,
    );
  });

  test("plugin exclude disables plugin skills", () => {
    const config = mergeWithDefaults({
      skills: {
        plugins: {
          exclude: ["@acme/opencode-experimental"],
        },
      },
    });

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-experimental/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-experimental",
      }),
      false,
    );
    assert.equal(
      isSkillEnabled(config.skills, {
        id: "project/release-checklist",
        name: "release-checklist",
      }),
      true,
    );
  });

  test("plugin include acts as an allowlist for plugin skills only", () => {
    const config = mergeWithDefaults({
      skills: {
        plugins: {
          include: ["@acme/opencode-release"],
        },
      },
    });

    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-release/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-release",
      }),
      true,
    );
    assert.equal(
      isSkillEnabled(config.skills, {
        id: "@acme/opencode-experimental/release-checklist",
        name: "release-checklist",
        pluginId: "@acme/opencode-experimental",
      }),
      false,
    );
    assert.equal(
      isSkillEnabled(config.skills, {
        id: "project/release-checklist",
        name: "release-checklist",
      }),
      true,
    );
  });
});
