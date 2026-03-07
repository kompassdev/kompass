#!/usr/bin/env bun

import { parseArgs } from "node:util";

import { createPrLoadTool } from "../tools/pr-load.ts";

import { createShell, createToolContext } from "./_tool-runner.ts";

const { values } = parseArgs({
  options: {
    pr: { type: "string" },
    reviews: { type: "boolean", default: false },
    comments: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    [
      "Usage: ./scripts/pr-load.ts [--pr <number|url>] [--reviews] [--comments]",
      "",
      "Examples:",
      "  ./scripts/pr-load.ts --reviews --comments",
      "  ./scripts/pr-load.ts --pr 123 --reviews --comments",
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
    comments: values.comments,
  },
  createToolContext(),
);

process.stdout.write(`${output}\n`);
