import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createToolContextForDirectory } from "../scripts/_tool-runner.ts";
import type { Shell, ShellPromise } from "../tools/shared.ts";
import { createTicketSyncTool } from "../tools/ticket-sync.ts";

describe("ticket_sync", () => {
  test("renders description, checklists, and labels when creating an issue", async () => {
    let executedCommand = "";
    const shell = createMockShell((command) => {
      executedCommand = command;
      return {
        stdout: "https://github.com/acme/repo/issues/9\n",
        stderr: "",
        exitCode: 0,
      };
    });

    const tool = createTicketSyncTool(shell);
    const output = await tool.execute({
      title: "Add plan sync improvements",
      description: "Capture planning output with clearer ticket formatting.",
      labels: ["planning", "tickets"],
      checklists: [
        {
          name: "Requirement",
          items: [{ name: "Improve the ticket plan prompt", completed: false }],
        },
        {
          name: "Validation",
          items: [{ name: "Confirm checklist sections render correctly", completed: true }],
        },
      ],
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.url, "https://github.com/acme/repo/issues/9");
    assert.match(executedCommand, /gh issue create/);
    assert.match(executedCommand, /--label planning/);
    assert.match(executedCommand, /--label tickets/);
    assert.match(executedCommand, /Capture planning output with clearer ticket formatting\./);
    assert.match(executedCommand, /### Requirement/);
    assert.match(executedCommand, /- \[ \] Improve the ticket plan prompt/);
    assert.match(executedCommand, /### Validation/);
    assert.match(executedCommand, /- \[x\] Confirm checklist sections render correctly/);
  });

  test("updates an existing issue with add-label flags", async () => {
    let executedCommand = "";
    const shell = createMockShell((command) => {
      executedCommand = command;
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
    });

    const tool = createTicketSyncTool(shell);
    const output = await tool.execute({
      title: "Refresh plan",
      body: "Updated body",
      labels: ["triage"],
      refUrl: "https://github.com/acme/repo/issues/9",
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.url, "https://github.com/acme/repo/issues/9");
    assert.match(executedCommand, /gh issue edit/);
    assert.match(executedCommand, /--add-label triage/);
    assert.match(executedCommand, /--body Updated body/);
  });

  test("posts a comment to an existing issue without editing metadata", async () => {
    const executedCommands: string[] = [];
    const shell = createMockShell((command) => {
      executedCommands.push(command);
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
    });

    const tool = createTicketSyncTool(shell);
    const output = await tool.execute({
      refUrl: "https://github.com/acme/repo/issues/9",
      comments: ["Here is the answer on the ticket."],
    }, createToolContextForDirectory("/tmp/repo"));

    const result = JSON.parse(output);
    assert.equal(result.url, "https://github.com/acme/repo/issues/9");
    assert.equal(executedCommands.length, 1);
    assert.match(executedCommands[0]!, /gh issue comment/);
    assert.match(executedCommands[0]!, /--body Here is the answer on the ticket\./);
  });
});

function createMockShell(
  handler: (command: string) => { stdout: string; stderr: string; exitCode: number },
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

    const result = handler(command);
    return createShellPromise(result);
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
