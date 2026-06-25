import { describe, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { resolveCommands } from "../commands/index.ts";

process.env.HOME = path.join(os.tmpdir(), `kompass-test-home-${process.pid}-core-commands`);

describe("resolveCommands", () => {
  test("includes root review config for pr/review", async () => {
    const commands = await resolveCommands(process.cwd());

    assert.deepEqual(commands["pr/review"]?.config, { enabled: true });
  });

  test("pr/review aligns named local branches but not detached head", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/review"]?.template ?? "";

    assert.match(template, /### Load Worktree Context/);
    assert.match(template, /Call `worktree_load` and store the result/);
    assert.match(template, /Run `gh pr checkout <pr-context\.pr\.number>`/);
    assert.match(template, /Do not checkout from detached HEAD for read-only PR review/);
    assert.match(template, /Inspect local repository files only when `<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
  });

  test("requires PR branch for pr/fix checkout alignment", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/fix"]?.template ?? "";

    assert.match(template, /### Load Worktree Context/);
    assert.match(template, /Call `worktree_load` and store the result/);
    assert.match(template, /`<current-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
    assert.match(template, /`<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context\.pr\.headRefOid>`/);
    assert.match(template, /Call `worktree_load` again/);
    assert.match(template, /Store `<current-branch>` as `<active-branch>` when it is available/);
    assert.match(template, /Do not inspect or modify local code for this PR until `<active-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
  });
});
