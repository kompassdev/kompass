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

  test("loads pr/review changes without checking out the PR branch", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/review"]?.template ?? "";

    assert.match(template, /head: <pr-context\.pr\.headRefName>/);
    assert.match(template, /Use `<changes>` as the source of truth/);
    assert.doesNotMatch(template, /Run `gh pr checkout <pr-context\.pr\.number>`/);
    assert.doesNotMatch(template, /<active-branch>/);
  });

  test("requires PR branch checkout for pr/fix", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/fix"]?.template ?? "";

    assert.match(template, /Run `gh pr checkout <pr-context\.pr\.number>` before analyzing repository files or making code changes for this PR/);
    assert.match(template, /Do not inspect or modify local code for this PR until `<active-branch>` equals `<pr-branch>`/);
    assert.doesNotMatch(template, /`<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context\.pr\.headRefOid>`/);
  });
});
