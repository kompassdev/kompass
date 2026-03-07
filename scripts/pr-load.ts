#!/usr/bin/env bun

import { parseArgs } from "node:util";

import { createPrLoadTool } from "../tools/pr-load.ts";

import { createShell, createToolContext } from "./_tool-runner.ts";

const { values } = parseArgs({
  options: {
    pr: { type: "string" },
    reviews: { type: "boolean", default: false },
    issueComments: { type: "boolean", default: false },
    threads: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    [
      "Usage: ./scripts/pr-load.ts [--pr <number|url>] [--reviews] [--issueComments] [--threads]",
      "",
      "Examples:",
      "  ./scripts/pr-load.ts --reviews --issueComments --threads",
      "  ./scripts/pr-load.ts --pr 123 --reviews --issueComments --threads",
      "  ./scripts/pr-load.ts --pr https://github.com/owner/repo/pull/123 --reviews --issueComments --threads",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const tool = createPrLoadTool(createShell());
const output = await tool.execute(
  {
    pr: values.pr,
    reviews: values.reviews,
    issueComments: values.issueComments,
    threads: values.threads,
  },
  createToolContext(),
);

process.stdout.write(`${output}\n`);
