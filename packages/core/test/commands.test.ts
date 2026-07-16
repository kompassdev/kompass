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

    assert.match(template, /Run `gh pr checkout <pr-context\.pr\.number>` before inspecting or modifying code/);
    assert.match(template, /STOP unless it equals `<pr-branch>`/);
    assert.match(template, /git merge-base --is-ancestor <base-ref> HEAD/);
    assert.match(template, /merge `<base-ref>` into `<active-branch>` without rebasing or force-pushing/);
    assert.doesNotMatch(template, /`<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context\.pr\.headRefOid>`/);
  });

  test("runs pr fix loop inline with incremental review loading", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/fix/loop"]?.template ?? "";

    assert.match(template, /gh pr checks <pr-number> --watch/);
    assert.match(template, /pr_load_review/);
    assert.match(template, /since: <review-checkpoint>/);
    assert.doesNotMatch(template, /<delegate/);
    assert.doesNotMatch(template, /question/);
  });

  test("registers current-session completion variants", async () => {
    const commands = await resolveCommands(process.cwd());

    assert.equal(commands["branch/inline"]?.subtask, false);
    assert.equal(commands["commit/inline"]?.subtask, false);
    assert.equal(commands["commit-and-push/inline"]?.subtask, false);
    assert.equal(commands["pr/create/inline"]?.subtask, false);
    assert.equal(commands["ship/inline"]?.subtask, false);
    assert.match(commands["branch/inline"]?.template ?? "", /Do not call `changes_load`/);
    assert.match(commands["commit/inline"]?.template ?? "", /Reuse the current session's known uncommitted changes/);
    assert.match(commands["commit-and-push/inline"]?.template ?? "", /Do not call `changes_load`/);
    assert.match(commands["commit-and-push/inline"]?.template ?? "", /git push -u origin <branch>/);
    assert.match(commands["pr/create/inline"]?.template ?? "", /Retain the authoritative branch comparison load/);
    assert.match(commands["pr/create/inline"]?.template ?? "", /call `changes_load`/);
    assert.match(commands["ship/inline"]?.template ?? "", /Do not call `changes_load` before the branch and commit phases/);
    assert.doesNotMatch(commands.commit?.template ?? "", /Reuse the current session's known uncommitted changes/);
  });
});
