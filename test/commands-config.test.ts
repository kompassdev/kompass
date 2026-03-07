import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { applyCommandsConfig } from "../commands/index.ts";

const originalCi = process.env.CI;

afterEach(() => {
  if (originalCi === undefined) {
    delete process.env.CI;
    return;
  }
  process.env.CI = originalCi;
});

describe("applyCommandsConfig", () => {
  test("embeds hyphenated component placeholders in default templates", async () => {
    delete process.env.CI;
    const cfg = {} as { command?: Record<string, { template: string }> };

    await applyCommandsConfig(cfg as never, process.cwd());

    assert.ok(cfg.command);
    assert.ok(cfg.command["pr/review"]);
    assert.doesNotMatch(cfg.command["pr/review"].template, /\{\{pr-review\}\}/);
    assert.match(cfg.command["pr/review"].template, /PR Review Navigation Guide/);
    assert.ok(cfg.command["dev"]);
    assert.doesNotMatch(cfg.command["dev"].template, /\{\{dev-flow\}\}|\{\{pr-author\}\}/);
  });

  test("marks commands as subtasks outside CI", async () => {
    delete process.env.CI;
    const cfg = {} as { command?: Record<string, { subtask: boolean }> };

    await applyCommandsConfig(cfg as never, process.cwd());

    assert.ok(cfg.command);
    assert.equal(cfg.command["pr/review"].subtask, true);
  });

  test("disables subtask mode in CI", async () => {
    process.env.CI = "true";
    const cfg = {} as { command?: Record<string, { subtask: boolean }> };

    await applyCommandsConfig(cfg as never, process.cwd());

    assert.ok(cfg.command);
    assert.equal(cfg.command["pr/review"].subtask, false);
  });
});
