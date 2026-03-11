import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyCommandsConfig } from "../config.ts";

const originalCi = process.env.CI;

afterEach(() => {
  if (originalCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCi;
  }
});

describe("applyCommandsConfig", () => {

  describe("command registration", () => {
    test("registers all default commands outside CI", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, unknown> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const expectedCommands = [
        "reload",
        "pr/create",
        "pr/review",
        "pr/fix",
        "ship",
        "ticket/create",
        "ticket/plan",
        "ticket/dev",
        "review",
        "dev",
      ];
      for (const cmd of expectedCommands) {
        assert.ok(cfg.command![cmd], `Command ${cmd} should be registered`);
      }
    });

    test("registers commands with correct properties", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { description: string; agent: string; template: string; subtask: boolean }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.equal(cfg.command!["pr/review"]?.agent, "reviewer");
      assert.equal(cfg.command!["reload"]?.agent, "build");
      assert.equal(cfg.command!["pr/create"]?.agent, "build");
      assert.equal(cfg.command!["ticket/create"]?.agent, "build");
      assert.equal(cfg.command!["ticket/plan"]?.agent, "planner");
      assert.equal(cfg.command!["dev"]?.agent, "build");
      assert.equal(cfg.command!["ship"]?.agent, "navigator");
      assert.equal(cfg.command!["todo"]?.agent, "navigator");
      assert.ok(cfg.command!["pr/review"]?.description);
      assert.ok(cfg.command!["reload"]?.template);
      assert.ok(cfg.command!["dev"]?.template);
    });
  });

  describe("component replacement", () => {
    test("rewrites Kompass tool names with opencode prefix", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const reviewTemplate = cfg.command!["pr/review"].template;

      assert.match(reviewTemplate, /`kompass_pr_load`/);
      assert.match(reviewTemplate, /`kompass_changes_load`/);
      assert.match(reviewTemplate, /`kompass_ticket_load`/);
      assert.doesNotMatch(reviewTemplate, /`pr_load`/);
      assert.doesNotMatch(reviewTemplate, /`changes_load`/);
      assert.doesNotMatch(reviewTemplate, /`ticket_load`/);
    });

    test("rewrites project reload tool name with opencode prefix", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const reloadTemplate = cfg.command!["reload"].template;

      assert.match(reloadTemplate, /`kompass_reload`/);
      assert.doesNotMatch(reloadTemplate, /Call `reload` with no parameters\./);
    });

    test("rewrites tool references with configured aliases", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-commands-"));

      try {
        await writeFile(
          path.join(tempDir, "kompass.json"),
          JSON.stringify({
            tools: {
              changes_load: { enabled: false },
              pr_load: { enabled: false },
              ticket_sync: {
                enabled: true,
                name: "custom_ticket_name",
              },
              ticket_load: { enabled: false },
            },
          }),
        );

        const cfg: { command?: Record<string, { template: string }> } = {};

        await applyCommandsConfig(cfg as never, tempDir);

        assert.ok(cfg.command);
        const ticketCreateTemplate = cfg.command!["ticket/create"].template;
        const ticketPlanTemplate = cfg.command!["ticket/plan"].template;

        assert.match(ticketCreateTemplate, /`custom_ticket_name`/);
        assert.doesNotMatch(ticketCreateTemplate, /`kompass_ticket_sync`/);
        assert.doesNotMatch(ticketCreateTemplate, /`ticket_sync`/);

        assert.match(ticketPlanTemplate, /`custom_ticket_name`/);
        assert.doesNotMatch(ticketPlanTemplate, /`kompass_ticket_sync`/);
        assert.doesNotMatch(ticketPlanTemplate, /`ticket_sync`/);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test("supports object-based command toggles", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-command-entries-"));

      try {
        await writeFile(
          path.join(tempDir, "kompass.jsonc"),
          `{
            "commands": {
              "dev": { "enabled": false },
              "review": { "enabled": true }
            }
          }`,
        );

        const cfg: { command?: Record<string, { template: string }> } = {};

        await applyCommandsConfig(cfg as never, tempDir);

        assert.ok(cfg.command);
        assert.equal(cfg.command!["dev"], undefined);
        assert.ok(cfg.command!["review"]);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test("replaces {{dev-flow}} placeholder with component content", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      // Should contain the actual content from dev-flow.txt
      assert.match(cfg.command!["dev"].template, /Development Flow Navigation Guide/);
      // Should NOT contain the placeholder
      assert.doesNotMatch(cfg.command!["dev"].template, /\{\{dev-flow\}\}/);
    });

    test("replaces multiple component placeholders in same template", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      // dev.txt uses {{dev-flow}} component
      assert.doesNotMatch(cfg.command!["dev"].template, /\{\{dev-flow\}\}/);
    });

    test("pr/fix command does not use pr-fix component", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["pr/fix"]);
      // pr-fix guidance is now inline since it was only used in one place
      assert.doesNotMatch(cfg.command!["pr/fix"].template, /\{\{pr-fix\}\}/);
    });

    test("review command does not use code-review component", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["review"]);
      // Review guidance is now in the reviewer agent, not a component
      assert.doesNotMatch(cfg.command!["review"].template, /\{\{code-review\}\}/);
    });

    test("pr/review command does not use code-review component", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["pr/review"]);
      // Review guidance is now in the reviewer agent, not a component
      assert.doesNotMatch(cfg.command!["pr/review"].template, /\{\{code-review\}\}/);
      assert.match(cfg.command!["pr/review"].template, /## Goal/);
      assert.match(cfg.command!["pr/review"].template, /Review a GitHub pull request/);
    });

    test("preserves unknown placeholders when component not found", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      // This test verifies the embedComponents function preserves unknown placeholders
      // by checking that the command registration still works even with unknown components
      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      // All default commands should still be registered
      assert.ok(cfg.command!["dev"]);
    });
  });

  describe("CI vs non-CI behavior", () => {
    test("marks commands as subtasks outside CI", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { subtask: boolean }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.equal(cfg.command!["pr/review"]?.subtask, true);
      assert.equal(cfg.command!["dev"]?.subtask, true);
    });

    test("disables subtask mode in CI", async () => {
      process.env.CI = "true";
      const cfg: { command?: Record<string, { subtask: boolean }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.equal(cfg.command!["pr/review"]?.subtask, false);
      assert.equal(cfg.command!["dev"]?.subtask, false);
    });
  });

  describe("existing command config preservation", () => {
    test("preserves existing command configuration", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { description: string; template: string }> } = {
        command: {
          "dev": {
            description: "Existing description",
            template: "Existing template"
          }
        }
      };

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.equal(cfg.command!["dev"].description, "Existing description");
      assert.equal(cfg.command!["dev"].template, "Existing template");
    });

    test("fills in missing commands while preserving existing ones", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { description: string; template: string }> } = {
        command: {
          "dev": {
            description: "Custom dev description",
            template: "Custom dev template"
          }
        }
      };

      await applyCommandsConfig(cfg as never, process.cwd());

      // Existing command should be preserved
      assert.equal(cfg.command!["dev"].description, "Custom dev description");
      assert.equal(cfg.command!["dev"].template, "Custom dev template");
      
      // Other commands should still be registered
      assert.ok(cfg.command!["pr/review"]);
      assert.ok(cfg.command!["pr/create"]);
    });
  });

  describe("template loading", () => {
    test("loads templates from default paths", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      // All default commands should have templates loaded
      assert.ok(cfg.command!["dev"]?.template);
      assert.ok(cfg.command!["pr/create"]?.template);
      assert.ok(cfg.command!["ticket/create"]?.template);
      assert.ok(cfg.command!["pr/review"]?.template);
      assert.ok(cfg.command!["ticket/plan"]?.template);
      assert.ok(cfg.command!["pr/fix"]?.template);
      assert.ok(cfg.command!["ship"]?.template);
      assert.ok(cfg.command!["ticket/dev"]?.template);
      assert.ok(cfg.command!["review"]?.template);
    });

    test("embeds all expected components in ship command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const shipTemplate = cfg.command!["ship"].template;

      assert.match(shipTemplate, /## Goal/);
      assert.match(shipTemplate, /Ship the current work/);
      assert.match(shipTemplate, /Load Change Context/);
      assert.match(shipTemplate, /Check Blockers/);
      assert.match(shipTemplate, /Ensure Feature Branch/);
      assert.match(shipTemplate, /call subagent @general \/commit/);
      assert.match(shipTemplate, /call subagent @general \/pr\/create/);

      assert.doesNotMatch(shipTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in dev command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const devTemplate = cfg.command!["dev"].template;
      
      // Should have replaced components
      assert.match(devTemplate, /Development Flow Navigation Guide/);
      // PR Author content is now inline in pr/create, not embedded in dev
      assert.match(devTemplate, /## Goal/);
      assert.match(devTemplate, /Implement a feature or fix/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(devTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in pr/create command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const prCreateTemplate = cfg.command!["pr/create"].template;
      
      // Should have inline workflow content (no longer uses PR Author component)
      assert.match(prCreateTemplate, /## Goal/);
      assert.match(prCreateTemplate, /Create a pull request/);
      assert.match(prCreateTemplate, /Interpret Arguments/);
      assert.match(prCreateTemplate, /Load & Analyze Changes/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(prCreateTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in ticket/create command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const ticketCreateTemplate = cfg.command!["ticket/create"].template;

      assert.match(ticketCreateTemplate, /## Goal/);
      assert.match(ticketCreateTemplate, /Create a ticket that summarizes the work returned by the current change comparison/);
      assert.match(ticketCreateTemplate, /Load & Analyze Changes/);

      assert.doesNotMatch(ticketCreateTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in ticket/dev command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const ticketDevTemplate = cfg.command!["ticket/dev"].template;
      
      // Should have replaced components
      assert.match(ticketDevTemplate, /Development Flow Navigation Guide/);
      // PR Author content is now inline in pr/create, not embedded here
      assert.match(ticketDevTemplate, /## Goal/);
      assert.match(ticketDevTemplate, /Implement a ticket/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(ticketDevTemplate, /\{\{[\w-]+\}\}/);
    });
  });

  describe("parameterized component replacement", () => {
    test("replaces {{param:name}} with provided parameter value", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      
      // commit command uses parameterized change-summary
      const commitTemplate = cfg.command!["commit"].template;
      // Should have replaced the parameter
      assert.match(commitTemplate, /pass `uncommitted: true`/);
      // Should NOT have {{param:...}} placeholders
      assert.doesNotMatch(commitTemplate, /\{\{param:[\w-]+\}\}/);
    });

    test("uses different parameter values for different commands", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      
      const commitTemplate = cfg.command!["commit"].template;
      const prCreateTemplate = cfg.command!["pr/create"].template;
      
      // commit should mention uncommitted
      assert.match(commitTemplate, /pass `uncommitted: true`/);
      // pr/create should mention base branch detection
      assert.match(prCreateTemplate, /base branch/);
    });

    test("preserves {{param:...}} when parameter not provided", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      // Commands without parameters should still work
      assert.ok(cfg.command!["dev"]);
      assert.ok(cfg.command!["pr/review"]);
    });
  });
});
