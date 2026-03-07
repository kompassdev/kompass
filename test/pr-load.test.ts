import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createToolContextForDirectory } from "../scripts/_tool-runner.ts";
import type { Shell, ShellPromise } from "../tools/shared.ts";
import { createPrLoadTool } from "../tools/pr-load.ts";

describe("pr_load", () => {
  test("normalizes threads and keeps multiline ranges", async () => {
    const shell = createMockShell([
      {
        contains: "gh pr view --json",
        stdout: JSON.stringify({
          number: 7,
          title: "Example PR",
          body: "Body",
          url: "https://github.com/acme/repo/pull/7",
          state: "OPEN",
          isDraft: false,
          reviewDecision: "",
          baseRefName: "main",
          headRefName: "feature",
          headRefOid: "abc123",
          author: { login: "octo" },
        }),
      },
      {
        contains: "gh repo view --json nameWithOwner",
        stdout: JSON.stringify({ nameWithOwner: "acme/repo" }),
      },
      {
        contains: "gh api user",
        stdout: JSON.stringify({ login: "review-bot" }),
      },
      {
        contains: "repos/acme/repo/pulls/7/reviews?per_page=100",
        stdout: JSON.stringify([
          [
            {
              id: 1,
              state: "COMMENTED",
              body: "Looks good",
              submitted_at: "2026-03-07T00:00:00Z",
              commit_id: "abc123",
              user: { login: "review-bot" },
            },
            {
              id: 2,
              state: "COMMENTED",
              body: "",
              submitted_at: "2026-03-07T00:00:01Z",
              commit_id: "abc123",
              user: { login: "review-bot" },
            },
          ],
        ]),
      },
      {
        contains: "repos/acme/repo/issues/7/comments?per_page=100",
        stdout: JSON.stringify([
          [
            {
              id: 10,
              body: "Normal comment",
              created_at: "2026-03-07T00:00:02Z",
              updated_at: "2026-03-07T00:00:02Z",
              user: { login: "octo" },
              html_url: "https://example.test/comment",
            },
          ],
        ]),
      },
      {
        contains: "gh api graphql",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                  nodes: [
                    {
                      id: "thread-1",
                      isResolved: false,
                      isOutdated: false,
                      path: "src/example.ts",
                      line: 7,
                      startLine: 5,
                      comments: {
                        nodes: [
                          {
                            id: "comment-1",
                            author: { login: "review-bot" },
                            body: "Please simplify this block",
                            createdAt: "2026-03-07T00:00:03Z",
                            updatedAt: "2026-03-07T00:00:03Z",
                            path: "src/example.ts",
                            line: 7,
                            startLine: 5,
                            url: "https://example.test/thread-comment",
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      },
    ]);

    const tool = createPrLoadTool(shell);
    const output = await tool.execute(
      {
        reviews: true,
        issueComments: true,
        threads: true,
      },
      createToolContextForDirectory("/tmp/repo"),
    );

    const result = JSON.parse(output);
    assert.equal(result.viewerLogin, "review-bot");
    assert.deepEqual(result.reviews, [
      {
        id: 1,
        state: "COMMENTED",
        author: "review-bot",
        body: "Looks good",
        submittedAt: "2026-03-07T00:00:00Z",
        commitId: "abc123",
      },
    ]);
    assert.deepEqual(result.issueComments, [
      {
        id: 10,
        author: "octo",
        createdAt: "2026-03-07T00:00:02Z",
        updatedAt: "2026-03-07T00:00:02Z",
        body: "Normal comment",
      },
    ]);
    assert.deepEqual(result.threads, [
      {
        id: "thread-1",
        path: "src/example.ts",
        startLine: 5,
        line: 7,
        isResolved: false,
        isOutdated: false,
        comments: [
          {
            id: "comment-1",
            author: "review-bot",
            body: "Please simplify this block",
            createdAt: "2026-03-07T00:00:03Z",
            updatedAt: "2026-03-07T00:00:03Z",
          },
        ],
      },
    ]);
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
    if (!fixture) {
      throw new Error(`Unhandled command: ${command}`);
    }

    return createShellPromise({
      stdout: fixture.stdout,
      stderr: fixture.stderr ?? "",
      exitCode: fixture.exitCode ?? 0,
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
