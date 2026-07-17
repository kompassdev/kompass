import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getCommandExecution } from "../index.ts";

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
