import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  expandSlashCommandPrompt,
  getCommandExecution,
  getTaskToolExecution,
} from "../index.ts";

describe("getTaskToolExecution", () => {
  test("expands slash commands for task tool calls", async () => {
    const output = {
      args: {
        prompt: "/review auth bug",
        description: "Run review command",
        subagent_type: "reviewer",
        command: "@reviewer /review auth bug",
      },
    };
    const execution = await getTaskToolExecution(
      {
        tool: "task",
        sessionID: "session-1",
        callID: "call-1",
      },
      output,
      process.cwd(),
    );

    assert.equal(execution?.raw_prompt, "/review auth bug");
    assert.equal(execution?.description, "Run review command");
    assert.equal(execution?.subagent_type, "reviewer");
    assert.equal(execution?.command, "@reviewer /review auth bug");
    assert.equal(execution?.command_name, "review");
    assert.equal(execution?.command_arguments, "auth bug");
    assert.match(execution?.prompt ?? "", /Store `auth bug` as `<arguments>`/);
    assert.equal(output.args.prompt, execution?.prompt);
  });

  test("ignores non-task tool calls", async () => {
    const execution = await getTaskToolExecution(
      {
        tool: "bash",
        sessionID: "session-1",
        callID: "call-1",
      },
      {
        args: {
          prompt: "should not be read",
        },
      },
      process.cwd(),
    );

    assert.equal(execution, undefined);
  });

  test("ignores task tool calls without a prompt or command", async () => {
    const execution = await getTaskToolExecution(
      {
        tool: "task",
        sessionID: "session-1",
        callID: "call-1",
      },
      {
        args: {
          description: "Fix auth bug",
          subagent_type: "planner",
        },
      },
      process.cwd(),
    );

    assert.equal(execution, undefined);
  });

  test("falls back to the raw task prompt when the command is unknown", async () => {
    const execution = await getTaskToolExecution(
      {
        tool: "task",
        sessionID: "session-1",
        callID: "call-1",
      },
      {
        args: {
          prompt: "/unknown auth bug",
          command: "/unknown auth bug",
        },
      },
      process.cwd(),
    );

    assert.deepEqual(execution, {
      prompt: "/unknown auth bug",
      raw_prompt: "/unknown auth bug",
      command: "/unknown auth bug",
      command_name: undefined,
      command_arguments: undefined,
      description: undefined,
      subagent_type: undefined,
    });
  });
});

describe("expandSlashCommandPrompt", () => {
  test("expands command templates using slash command arguments", async () => {
    const execution = await expandSlashCommandPrompt(process.cwd(), "@general /review asd");

    assert.deepEqual(execution?.command, "review");
    assert.deepEqual(execution?.arguments, "asd");
    assert.match(execution?.prompt ?? "", /Store `asd` as `<arguments>`/);
  });
});

describe("getCommandExecution", () => {
  test("reads the expanded command prompt from text parts", () => {
    const execution = getCommandExecution(
      {
        command: "review",
        sessionID: "session-2",
        arguments: "auth bug",
      },
      {
        parts: [
          {
            id: "part-1",
            sessionID: "session-2",
            messageID: "message-1",
            type: "text",
            text: "expanded command prompt",
          },
        ],
      },
    );

    assert.deepEqual(execution, {
      command: "review",
      arguments: "auth bug",
      prompt: "expanded command prompt",
    });
  });

  test("ignores command executions without text parts", () => {
    const execution = getCommandExecution(
      {
        command: "review",
        sessionID: "session-2",
        arguments: "auth bug",
      },
      {
        parts: [
          {
            id: "part-1",
            sessionID: "session-2",
            messageID: "message-1",
            type: "subtask",
            prompt: "/review auth bug",
            description: "Run review command",
            agent: "general",
          },
        ],
      },
    );

    assert.equal(execution, undefined);
  });
});
