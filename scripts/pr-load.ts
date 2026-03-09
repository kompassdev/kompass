#!/usr/bin/env bun

import { parseArgs } from "node:util";

import { createPrLoadTool } from "../tools/pr-load.ts";

import { createShell, createToolContext } from "./_tool-runner.ts";

const { values } = parseArgs({
  options: {
    pr: { type: "string" },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    [
      "Usage: ./scripts/pr-load.ts [--pr <number|url>]",
      "",
      "Examples:",
      "  ./scripts/pr-load.ts",
      "  ./scripts/pr-load.ts --pr 123",
      "  ./scripts/pr-load.ts --pr https://github.com/owner/repo/pull/123",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const tool = createPrLoadTool(createShell());
const output = await tool.execute(
  {
    pr: values.pr,
  },
  createToolContext(),
);

process.stdout.write(`${output}\n`);
