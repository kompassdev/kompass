import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isSkillEnabled, loadKompassConfig, mergeWithDefaults } from "../lib/config.ts";

describe("config loading", () => {
  test("parses jsonc config files before json files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-config-"));

    try {
      await writeFile(
        path.join(tempDir, "kompass.jsonc"),
        `{
          // jsonc should be supported
          "commands": {
            "dev": {
              "enabled": false,
            },
          },
        }`,
      );
      await writeFile(
        path.join(tempDir, "kompass.json"),
        JSON.stringify({
          commands: {
            dev: { enabled: true },
          },
        }),
      );

      const config = await loadKompassConfig(tempDir);

      assert.equal(config?.commands?.dev?.enabled, false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("object-based config", () => {
  test("supports command, agent, and component entry toggles", () => {
    const config = mergeWithDefaults({
      commands: {
        dev: { enabled: false },
        review: { enabled: true, template: "commands/custom-review.txt" },
      },
      agents: {
        reviewer: { enabled: false },
      },
      components: {
        "dev-flow": { enabled: false },
        commit: { path: "components/custom-commit.txt" },
      },
    });

    assert.equal(config.commands.enabled.includes("dev"), false);
    assert.equal(config.commands.enabled.includes("review"), true);
    assert.equal(config.commands.templates.review, "commands/custom-review.txt");
    assert.equal(config.agents.enabled.includes("reviewer"), false);
    assert.equal(config.components.enabled.includes("dev-flow"), false);
    assert.equal(config.components.paths.commit, "components/custom-commit.txt");
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
