import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createToolContextForDirectory } from "../scripts/_tool-runner.ts";
import type { Shell, ShellPromise } from "../tools/shared.ts";
import { createPrSyncTool } from "../tools/pr-sync.ts";

describe("pr_sync", () => {
  test("approves an existing PR without posting a review body", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell(executedCommands, [
      {
        contains: "gh pr view https://github.com/acme/repo/pull/9 --json number,url",
        stdout: JSON.stringify({ number: 9, url: "https://github.com/acme/repo/pull/9" }),
      },
      {
        contains: "gh pr review https://github.com/acme/repo/pull/9 --approve",
        stdout: "",
      },
    ]);

    const tool = createPrSyncTool(shell);
    const output = await tool.execute({
      refUrl: "https://github.com/acme/repo/pull/9",
      review: { approve: true },
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.url, "https://github.com/acme/repo/pull/9");
    assert.equal(result.action, "approved");
  });

  test("updates and approves an existing PR in one call", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell(executedCommands, [
      {
        contains: "gh pr view https://github.com/acme/repo/pull/9 --json number,url",
        stdout: JSON.stringify({ number: 9, url: "https://github.com/acme/repo/pull/9" }),
      },
      {
        contains: "gh pr edit https://github.com/acme/repo/pull/9",
        stdout: "",
      },
      {
        contains: "gh pr review https://github.com/acme/repo/pull/9 --approve",
        stdout: "",
      },
    ]);

    const tool = createPrSyncTool(shell);
    const output = await tool.execute({
      title: "Tighten review automation",
      body: "Updated body",
      refUrl: "https://github.com/acme/repo/pull/9",
      review: { approve: true },
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.action, "updated_and_approved");
    assert.match(executedCommands[1], /--title Tighten review automation/);
    assert.match(executedCommands[1], /--body Updated body/);
  });

  test("submits structured review comments through pr_sync", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell(executedCommands, [
      {
        contains: "gh pr view https://github.com/acme/repo/pull/9 --json number,url",
        stdout: JSON.stringify({ number: 9, url: "https://github.com/acme/repo/pull/9" }),
      },
      {
        contains: "gh repo view --json nameWithOwner",
        stdout: JSON.stringify({ nameWithOwner: "acme/repo" }),
      },
      {
        contains: "/repos/acme/repo/pulls/9/reviews --input -",
        stdout: JSON.stringify({ html_url: "https://github.com/acme/repo/pull/9#pullrequestreview-3" }),
      },
    ]);

    const tool = createPrSyncTool(shell);
    const output = await tool.execute({
      refUrl: "https://github.com/acme/repo/pull/9",
      commitId: "abc123",
      review: {
        body: "★★★☆☆\n\nPlease address the inline note.",
        comments: [
          {
            path: "src/example.ts",
            line: 12,
            body: "This branch needs a guard.",
          },
        ],
      },
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.action, "reviewed");
    assert.equal(result.reviewUrl, "https://github.com/acme/repo/pull/9#pullrequestreview-3");
    assert.match(executedCommands[2], /"event":"COMMENT"/);
    assert.match(executedCommands[2], /"commit_id":"abc123"/);
    assert.match(executedCommands[2], /"path":"src\/example.ts"/);
    assert.match(executedCommands[2], /"line":12/);
  });

  test("approves and submits review comments in one call", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell(executedCommands, [
      {
        contains: "gh pr view https://github.com/acme/repo/pull/9 --json number,url",
        stdout: JSON.stringify({ number: 9, url: "https://github.com/acme/repo/pull/9" }),
      },
      {
        contains: "gh pr review https://github.com/acme/repo/pull/9 --approve",
        stdout: "",
      },
      {
        contains: "gh repo view --json nameWithOwner",
        stdout: JSON.stringify({ nameWithOwner: "acme/repo" }),
      },
      {
        contains: "/repos/acme/repo/pulls/9/reviews --input -",
        stdout: JSON.stringify({ html_url: "https://github.com/acme/repo/pull/9#pullrequestreview-4" }),
      },
    ]);

    const tool = createPrSyncTool(shell);
    const output = await tool.execute({
      refUrl: "https://github.com/acme/repo/pull/9",
      commitId: "abc123",
      review: {
        approve: true,
        body: "LGTM with minor suggestions",
        comments: [
          {
            path: "src/example.ts",
            line: 12,
            body: "Consider adding a comment here.",
          },
        ],
      },
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.action, "approved_and_reviewed");
    assert.equal(result.reviewUrl, "https://github.com/acme/repo/pull/9#pullrequestreview-4");
  });

  test("posts a general comment and thread reply in one call", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell(executedCommands, [
      {
        contains: "gh pr view https://github.com/acme/repo/pull/9 --json number,url",
        stdout: JSON.stringify({ number: 9, url: "https://github.com/acme/repo/pull/9" }),
      },
      {
        contains: "gh pr comment https://github.com/acme/repo/pull/9 --body Fixed in the latest commit",
        stdout: "",
      },
      {
        contains: "gh repo view --json nameWithOwner",
        stdout: JSON.stringify({ nameWithOwner: "acme/repo" }),
      },
      {
        contains: "/repos/acme/repo/pulls/comments/42",
        stdout: JSON.stringify({ commit_id: "abc123", path: "src/example.ts", line: 12 }),
      },
      {
        contains: "/repos/acme/repo/pulls/9/comments --input -",
        stdout: JSON.stringify({ id: 43 }),
      },
    ]);

    const tool = createPrSyncTool(shell);
    const output = await tool.execute({
      refUrl: "https://github.com/acme/repo/pull/9",
      commentBody: "Fixed in the latest commit",
      replies: [{ inReplyTo: 42, body: "Handled in 9c1d2ab." }],
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.action, "commented_and_replied");
    assert.match(executedCommands[4], /"in_reply_to":42/);
    assert.match(executedCommands[4], /"body":"Handled in 9c1d2ab\."/);
  });
});

function createMockShell(
  executedCommands: string[],
  responses: Array<{ contains: string; stdout: string; stderr?: string; exitCode?: number }>,
): Shell {
  return (strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0] ?? "";
    expressions.forEach((expression, index) => {
      if (Array.isArray(expression)) {
        command += expression.join(" ") + (strings[index + 1] ?? "");
      } else {
        command += String(expression) + (strings[index + 1] ?? "");
      }
    });

    executedCommands.push(command);
    const response = responses.find((candidate) => command.includes(candidate.contains));

    if (!response) {
      throw new Error(`Unexpected command: ${command}`);
    }

    return createShellPromise({
      stdout: response.stdout,
      stderr: response.stderr ?? "",
      exitCode: response.exitCode ?? 0,
    });
  };
}

function createShellPromise(result: { stdout: string; stderr: string; exitCode: number }): ShellPromise {
  return {
    cwd() {
      return this;
    },
    quiet() {
      return this;
    },
    nothrow() {
      return this;
    },
    text() {
      return result.stdout;
    },
    json() {
      return JSON.parse(result.stdout);
    },
    exitCode: result.exitCode,
    stderr: Buffer.from(result.stderr),
  };
}
