import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { renderTemplate } from "../lib/components.ts";

describe("renderTemplate", () => {
  test("renders Eta partials from registered components", () => {
    const output = renderTemplate(
      "Before\n<%~ include(\"@snippet\", { message: \"Hello\" }) %>\nAfter",
      {
        snippet: "Message: <%= it.message %>",
      },
    );

    assert.equal(output, "Before\nMessage: Hello\nAfter");
  });

  test("supports Eta conditionals with template data", () => {
    const output = renderTemplate(
      "<% if (it.config.shared.prApprove === false) { %>stars<% } else { %>approve<% } %>",
      {},
      { config: { shared: { prApprove: false } } },
    );

    assert.equal(output, "stars");
  });
});
