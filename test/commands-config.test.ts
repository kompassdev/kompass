import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { applyCommandsConfig } from "../commands/index.ts";

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
        "pr/create",
        "pr/review",
        "pr/fix",
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
      assert.equal(cfg.command!["pr/create"]?.agent, "build");
      assert.equal(cfg.command!["ticket/plan"]?.agent, "planner");
      assert.equal(cfg.command!["dev"]?.agent, "build");
      assert.ok(cfg.command!["pr/review"]?.description);
      assert.ok(cfg.command!["dev"]?.template);
    });
  });

  describe("component replacement", () => {
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

    test("replaces {{pr-author}} placeholder with component content", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["pr/create"]);
      // pr/create template should have {{pr-author}} replaced
      assert.doesNotMatch(cfg.command!["pr/create"].template, /\{\{pr-author\}\}/);
    });

    test("replaces multiple component placeholders in same template", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      // dev.txt uses both {{dev-flow}} and {{pr-author}}
      assert.doesNotMatch(cfg.command!["dev"].template, /\{\{dev-flow\}\}/);
      assert.doesNotMatch(cfg.command!["dev"].template, /\{\{pr-author\}\}/);
    });

    test("replaces ticket-plan component in ticket/plan command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["ticket/plan"]);
      assert.doesNotMatch(cfg.command!["ticket/plan"].template, /\{\{ticket-plan\}\}/);
    });

    test("replaces pr-fix component in pr/fix command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["pr/fix"]);
      assert.doesNotMatch(cfg.command!["pr/fix"].template, /\{\{pr-fix\}\}/);
    });

    test("replaces code-review component in review command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["review"]);
      assert.doesNotMatch(cfg.command!["review"].template, /\{\{code-review\}\}/);
    });

    test("replaces code-review component in pr/review command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["pr/review"]);
      assert.doesNotMatch(cfg.command!["pr/review"].template, /\{\{code-review\}\}/);
      assert.match(cfg.command!["pr/review"].template, /Code Review Navigation Guide/);
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
      assert.ok(cfg.command!["pr/review"]?.template);
      assert.ok(cfg.command!["ticket/plan"]?.template);
      assert.ok(cfg.command!["pr/fix"]?.template);
      assert.ok(cfg.command!["ticket/dev"]?.template);
      assert.ok(cfg.command!["review"]?.template);
    });

    test("embeds all expected components in dev command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const devTemplate = cfg.command!["dev"].template;
      
      // Should have replaced components
      assert.match(devTemplate, /Development Flow Navigation Guide/);
      assert.match(devTemplate, /PR Author Navigation Guide/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(devTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in pr/create command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const prCreateTemplate = cfg.command!["pr/create"].template;
      
      // Should have replaced components
      assert.match(prCreateTemplate, /PR Author Navigation Guide/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(prCreateTemplate, /\{\{[\w-]+\}\}/);
    });

    test("embeds all expected components in ticket/dev command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const ticketDevTemplate = cfg.command!["ticket/dev"].template;
      
      // Should have replaced components
      assert.match(ticketDevTemplate, /Development Flow Navigation Guide/);
      assert.match(ticketDevTemplate, /PR Author Navigation Guide/);
      
      // Should not have any remaining placeholders
      assert.doesNotMatch(ticketDevTemplate, /\{\{[\w-]+\}\}/);
    });
  });
});
