import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createTicketProviderChain } from "../tools/provider/factory.ts";
import { textFromAdf } from "../tools/provider/jira.ts";
import { TicketProviderName } from "../tools/provider/interface.ts";
import type { Shell } from "../tools/shared.ts";

const shell = (() => {
  throw new Error("The provider test does not execute shell commands");
}) as unknown as Shell;

describe("ticket provider chain", () => {
  test("orders providers according to the configured preference", () => {
    const github = createTicketProviderChain(shell, TicketProviderName.GitHub);
    const jira = createTicketProviderChain(shell, TicketProviderName.Jira);

    assert.equal(github.name, TicketProviderName.GitHub);
    assert.equal(jira.name, TicketProviderName.Jira);
    assert.equal(github.canLoad("owner/repo#12"), true);
    assert.equal(jira.canLoad("PROJ-12"), true);
  });

  test("routes recognizable references to a provider in the chain", () => {
    const chain = createTicketProviderChain(shell, TicketProviderName.GitHub);

    assert.equal(chain.canSync("https://github.com/owner/repo/issues/12"), true);
    assert.equal(chain.canSync("https://example.atlassian.net/browse/PROJ-12"), true);
    assert.equal(chain.canSync(), true);
  });

  test("extracts text nodes from Jira ADF descriptions", () => {
    assert.equal(textFromAdf({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Implement Jira support" }],
      }],
    }), "Implement Jira support");
  });
});
