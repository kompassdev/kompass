import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createToolContextForDirectory } from "../scripts/_tool-runner.ts";
import type { Shell, ShellPromise } from "../tools/shared.ts";
import { createWorktreeLoadTool } from "../tools/worktree-load.ts";

describe("worktree_load", () => {
  test("loads branch and head state", async () => {
    const tool = createWorktreeLoadTool(createMockShell([
      { contains: "git branch --show-current", stdout: "feature\n" },
      { contains: "git rev-parse HEAD", stdout: "abc123\n" },
    ]));

    const output = await tool.execute({}, createToolContextForDirectory("/tmp/repo"));

    assert.deepEqual(JSON.parse(output), {
      branch: "feature",
      headOid: "abc123",
      isDetached: false,
    });
  });

  test("reports detached head", async () => {
    const tool = createWorktreeLoadTool(createMockShell([
      { contains: "git branch --show-current", stdout: "" },
      { contains: "git rev-parse HEAD", stdout: "merge123\n" },
    ]));

    const output = await tool.execute({}, createToolContextForDirectory("/tmp/repo"));

    assert.deepEqual(JSON.parse(output), {
      headOid: "merge123",
      isDetached: true,
    });
  });
});

function createMockShell(
  fixtures: Array<{ contains: string; stdout: string; stderr?: string; exitCode?: number }>,
): Shell {
  return (strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0] ?? "";
    expressions.forEach((expression, index) => {
      command += String(expression) + (strings[index + 1] ?? "");
    });

    const fixture = fixtures.find((item) => command.includes(item.contains));
    if (!fixture) throw new Error(`Unhandled command: ${command}`);

    return createShellPromise({
      stdout: fixture.stdout,
      stderr: fixture.stderr ?? "",
      exitCode: fixture.exitCode ?? 0,
    });
  };
}

function createShellPromise(result: { stdout: string; stderr: string; exitCode: number }): ShellPromise {
  return {
    cwd() { return this; },
    quiet() { return this; },
    nothrow() { return this; },
    text() { return result.stdout; },
    json() { return JSON.parse(result.stdout); },
    exitCode: result.exitCode,
    stderr: Buffer.from(result.stderr),
  };
}
