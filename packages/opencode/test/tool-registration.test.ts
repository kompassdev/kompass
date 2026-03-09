import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createOpenCodeTools } from "../index.ts";

describe("createOpenCodeTools", () => {
  test("registers Kompass tools with prefixed names", async () => {
    const tools = await createOpenCodeTools((() => {
      throw new Error("not implemented");
    }) as never, process.cwd());

    assert.ok(tools.kompass_changes_load);
    assert.ok(tools.kompass_pr_load);
    assert.ok(tools.kompass_ticket_load);
    assert.ok(tools.kompass_ticket_create);
    assert.equal(tools.changes_load, undefined);
    assert.equal(tools.pr_load, undefined);
    assert.equal(tools.ticket_load, undefined);
    assert.equal(tools.ticket_create, undefined);
  });
});
