import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyCommandsConfig } from "../config.ts";

const originalCi = process.env.CI;
const isolatedHome = path.join(os.tmpdir(), `kompass-test-home-${process.pid}-commands-config`);

process.env.HOME = isolatedHome;

afterEach(() => {
  if (originalCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCi;
  }

  process.env.HOME = isolatedHome;
});

describe("applyCommandsConfig", () => {

  describe("command registration", () => {
    test("registers all default commands outside CI", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, unknown> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const expectedCommands = [
        "ask",
        "branch",
        "pr/create",
        "pr/review",
        "pr/fix",
        "ship",
        "ticket/ask",
        "ticket/create",
        "ticket/plan",
        "ticket/plan-and-sync",
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
      assert.equal(cfg.command!["branch"]?.agent, "build");
      assert.equal(cfg.command!["pr/create"]?.agent, "build");
      assert.equal(cfg.command!["ticket/create"]?.agent, "build");
      assert.equal(cfg.command!["ticket/plan"]?.agent, "planner");
      assert.equal(cfg.command!["ticket/plan-and-sync"]?.agent, "planner");
      assert.equal(cfg.command!["ask"]?.agent, "build");
      assert.equal(cfg.command!["ticket/ask"]?.agent, "build");
      assert.equal(cfg.command!["dev"]?.agent, "navigator");
      assert.equal(cfg.command!["ship"]?.agent, "navigator");
      assert.equal(cfg.command!["todo"]?.agent, "navigator");
      assert.ok(cfg.command!["pr/review"]?.description);
      assert.ok(cfg.command!["dev"]?.template);
      assert.ok(cfg.command!["branch"]?.template);
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
      assert.match(reviewTemplate, /`kompass_pr_sync`/);
      assert.match(reviewTemplate, /`kompass_ticket_load`/);
      assert.doesNotMatch(reviewTemplate, /`pr_load`/);
      assert.doesNotMatch(reviewTemplate, /`changes_load`/);
      assert.doesNotMatch(reviewTemplate, /`pr_sync`/);
      assert.doesNotMatch(reviewTemplate, /`ticket_load`/);
    });

    test("pr/fix template uses pr_sync only", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const fixTemplate = cfg.command!["pr/fix"].template;

      assert.match(fixTemplate, /`kompass_pr_sync`/);
      assert.doesNotMatch(fixTemplate, /`kompass_pr_review`/);
      assert.doesNotMatch(fixTemplate, /`pr_review`/);
    });

    test("rewrites tool references with configured aliases", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-commands-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "tools": {
              "changes_load": { "enabled": false },
              "pr_load": { "enabled": false },
              "ticket_sync": {
                "enabled": true,
                "name": "custom_ticket_name"
              },
              "ticket_load": { "enabled": false }
            }
          }`,
        );

        const cfg: { command?: Record<string, { template: string }> } = {};

        await applyCommandsConfig(cfg as never, tempDir);

        assert.ok(cfg.command);
        const ticketCreateTemplate = cfg.command!["ticket/create"].template;
        const ticketPlanTemplate = cfg.command!["ticket/plan"].template;
        const ticketPlanAndSyncTemplate = cfg.command!["ticket/plan-and-sync"].template;

        assert.match(ticketCreateTemplate, /`custom_ticket_name`/);
        assert.doesNotMatch(ticketCreateTemplate, /`kompass_ticket_sync`/);
        assert.doesNotMatch(ticketCreateTemplate, /`ticket_sync`/);

        assert.doesNotMatch(ticketPlanTemplate, /`custom_ticket_name`/);
        assert.doesNotMatch(ticketPlanTemplate, /`kompass_ticket_sync`/);
        assert.doesNotMatch(ticketPlanTemplate, /`ticket_sync`/);

        assert.match(ticketPlanAndSyncTemplate, /`custom_ticket_name`/);
        assert.doesNotMatch(ticketPlanAndSyncTemplate, /`kompass_ticket_sync`/);
        assert.doesNotMatch(ticketPlanAndSyncTemplate, /`ticket_sync`/);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test("supports object-based command toggles", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-command-entries-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
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

    test("renders shared validation guidance from config", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-validation-guidance-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "validation": [
                "Run npm test if available",
                "Run npm run lint if available"
              ]
            }
          }`,
        );

        const cfg: { command?: Record<string, { template: string }> } = {};

        await applyCommandsConfig(cfg as never, tempDir);

        assert.ok(cfg.command);
        assert.match(cfg.command!["dev"].template, /Run npm test if available/);
        assert.match(cfg.command!["dev"].template, /Run npm run lint if available/);
        assert.doesNotMatch(
          cfg.command!["dev"].template,
          /Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist/,
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test("renders Eta partial content into commands", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      // Should contain the actual content from dev-flow.md
      assert.match(cfg.command!["dev"].template, /Development Flow Navigation Guide/);
      assert.doesNotMatch(cfg.command!["dev"].template, /<%/);
    });

    test("renders commands with all partials expanded", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      assert.doesNotMatch(cfg.command!["dev"].template, /<%/);
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
      assert.doesNotMatch(cfg.command!["pr/review"].template, /<%/);
      assert.doesNotMatch(cfg.command!["pr/review"].template, /\n{3,}/);
      assert.match(cfg.command!["pr/review"].template, /approve the PR instead/);
      assert.match(cfg.command!["pr/review"].template, /only `review\.approve: true`/);
    });

    test("pr/review supports disabling approval via template data", async () => {
      delete process.env.CI;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "kompass-pr-review-template-data-"));

      try {
        await mkdir(path.join(tempDir, ".opencode"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".opencode", "kompass.jsonc"),
          `{
            "shared": {
              "prApprove": false
            }
          }`,
        );

        const cfg: { command?: Record<string, { template: string }> } = {};

        await applyCommandsConfig(cfg as never, tempDir);

        assert.ok(cfg.command);
        assert.match(
          cfg.command!["pr/review"].template,
          /publish it as review feedback with `★★★★★` at the start of `review\.body`/,
        );
        assert.doesNotMatch(cfg.command!["pr/review"].template, /\n{3,}/);
        assert.match(cfg.command!["pr/review"].template, /If `<publish-grade>` is `★★★★★`:/);
        assert.match(cfg.command!["pr/review"].template, /`kompass_pr_sync` with `refUrl: <pr-context\.pr\.url>` and `review\.body` starting with `★★★★★`/);
        assert.match(cfg.command!["pr/review"].template, /If there are no positive summary notes, the body must be exactly `★★★★★`/);
        assert.doesNotMatch(cfg.command!["pr/review"].template, /approve|approval|approved/i);
        assert.doesNotMatch(cfg.command!["pr/review"].template, /only `review\.approve: true`/);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    test("renders templates without leaving Eta tags behind", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.doesNotMatch(cfg.command!["pr/create"].template, /<%/);
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
      assert.equal(cfg.command!["ship"]?.subtask, true);
      assert.equal(cfg.command!["todo"]?.subtask, true);
    });

    test("disables subtask mode in CI", async () => {
      process.env.CI = "true";
      const cfg: { command?: Record<string, { subtask: boolean }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.equal(cfg.command!["pr/review"]?.subtask, false);
      assert.equal(cfg.command!["dev"]?.subtask, false);
      assert.equal(cfg.command!["ship"]?.subtask, false);
      assert.equal(cfg.command!["todo"]?.subtask, false);
    });
  });

  describe("existing command config overwrite", () => {
    test("overwrites existing command configuration", async () => {
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

      assert.notEqual(cfg.command!["dev"].description, "Existing description");
      assert.notEqual(cfg.command!["dev"].template, "Existing template");
      assert.match(cfg.command!["dev"].template, /## Goal/);
    });

    test("overwrites existing commands and still registers the rest", async () => {
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

      assert.notEqual(cfg.command!["dev"].description, "Custom dev description");
      assert.notEqual(cfg.command!["dev"].template, "Custom dev template");

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
      assert.ok(cfg.command!["ask"]?.template);
      assert.ok(cfg.command!["pr/review"]?.template);
      assert.ok(cfg.command!["ticket/ask"]?.template);
      assert.ok(cfg.command!["ticket/plan"]?.template);
      assert.ok(cfg.command!["ticket/plan-and-sync"]?.template);
      assert.ok(cfg.command!["pr/fix"]?.template);
      assert.ok(cfg.command!["ship"]?.template);
      assert.ok(cfg.command!["ticket/dev"]?.template);
      assert.ok(cfg.command!["review"]?.template);
    });

    test("embeds literal dispatch blocks in ship command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const shipTemplate = cfg.command!["ship"].template;

      assert.match(shipTemplate, /## Goal/);
      assert.match(shipTemplate, /Ship the current work by delegating/);
      assert.match(shipTemplate, /Ensure Feature Branch/);
      assert.match(shipTemplate, /<dispatch agent="worker">/);
      assert.match(shipTemplate, /\n\/branch\nBranch naming guidance: <branch-context>\n<\/dispatch>/);
      assert.match(shipTemplate, /Store the subagent result as `<branch-result>`/);
      assert.match(shipTemplate, /Store the subagent result as `<commit-result>`/);
      assert.match(shipTemplate, /\n\/commit\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(shipTemplate, /Store the subagent result as `<pr-result>`/);
      assert.match(shipTemplate, /\n\/pr\/create\nBase branch: <base>\nAdditional context: <additional-context>\n<\/dispatch>/);

      assert.doesNotMatch(shipTemplate, /<%/);
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
      
      assert.doesNotMatch(devTemplate, /<%/);
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
      
      assert.doesNotMatch(prCreateTemplate, /<%/);
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

      assert.doesNotMatch(ticketCreateTemplate, /<%/);
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
      assert.match(ticketDevTemplate, /<dispatch agent="worker">/);
      assert.match(ticketDevTemplate, /\n\/dev\nTicket reference: <ticket-ref>\nTicket context: <ticket-context>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(ticketDevTemplate, /\n\/branch\nBranch naming guidance: <ticket-summary>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(ticketDevTemplate, /\n\/commit-and-push\nTicket reference: <ticket-ref>\nTicket summary: <ticket-summary>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(ticketDevTemplate, /\n\/pr\/create\nTicket reference: <ticket-ref>\nTicket context: <ticket-context>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.doesNotMatch(ticketDevTemplate, /<task agent=/);

      assert.doesNotMatch(ticketDevTemplate, /<%/);
    });

    test("embeds literal dispatch blocks in todo command", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      const todoTemplate = cfg.command!["todo"].template;

      assert.match(todoTemplate, /## Goal/);
      assert.match(todoTemplate, /Work through a todo file one pending item at a time/);
      assert.match(todoTemplate, /<dispatch agent="planner">/);
      assert.match(todoTemplate, /\n\/ticket\/plan\nTask: <task>\nTask context: <task-context>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(todoTemplate, /<dispatch agent="worker">/);
      assert.match(todoTemplate, /Current plan: <plan>\nPlan feedback: <user-answer>/);
      assert.match(todoTemplate, /\n\/dev\nPlan: <plan>\nTask: <task>\nTask context: <task-context>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.match(todoTemplate, /\n\/commit\nTask: <task>\nAdditional context: <additional-context>\n<\/dispatch>/);
      assert.doesNotMatch(todoTemplate, /<task agent=/);

      assert.doesNotMatch(todoTemplate, /<%/);
    });
  });

  describe("partial locals", () => {
    test("passes locals into Eta partials", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      
      const commitTemplate = cfg.command!["commit"].template;
      assert.match(commitTemplate, /pass `uncommitted: true`/);
      assert.doesNotMatch(commitTemplate, /<%/);
    });

    test("uses different local values for different commands", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      
      const commitTemplate = cfg.command!["commit"].template;
      const prCreateTemplate = cfg.command!["pr/create"].template;
      
      assert.match(commitTemplate, /pass `uncommitted: true`/);
      assert.match(prCreateTemplate, /base branch/);
    });

    test("renders commands that do not need partial locals", async () => {
      delete process.env.CI;
      const cfg: { command?: Record<string, { template: string }> } = {};

      await applyCommandsConfig(cfg as never, process.cwd());

      assert.ok(cfg.command);
      assert.ok(cfg.command!["dev"]);
      assert.ok(cfg.command!["pr/review"]);
    });
  });
});
