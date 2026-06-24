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

  test("skips PR checkout when pr/review is already at PR head", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/review"]?.template ?? "";

    assert.match(template, /git rev-parse HEAD/);
    assert.match(template, /`<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
    assert.match(template, /Run `gh pr checkout <pr-context\.pr\.number>`/);
    assert.match(template, /do not retry checkout unless the user explicitly asks/);
  });

  test("requires PR branch for pr/fix checkout alignment", async () => {
    const commands = await resolveCommands(process.cwd());
    const template = commands["pr/fix"]?.template ?? "";

    assert.match(template, /`<current-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
    assert.match(template, /`<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context\.pr\.headRefOid>`/);
    assert.match(template, /Do not inspect or modify local code for this PR until `<active-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context\.pr\.headRefOid>`/);
  });
});
