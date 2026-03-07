#!/usr/bin/env bun

import { parseArgs } from "node:util";

import { createChangesLoadTool } from "../tools/changes-load.ts";

import { createShell, createToolContext } from "./_tool-runner.ts";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
    depthHint: { type: "string" },
    diff: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    [
      "Usage: ./scripts/changes-load.ts [--base <ref>] [--head <ref>] [--depthHint <n>] [--diff]",
      "",
      "Examples:",
      "  ./scripts/changes-load.ts --diff",
      "  ./scripts/changes-load.ts --base origin/main --head HEAD --diff",
      "  ./scripts/changes-load.ts --base origin/main --head <sha> --depthHint 12 --diff",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const depthHintInput = values.depthHint;
let depthHint: number | undefined;

if (depthHintInput) {
  const parsedDepthHint = Number(depthHintInput);
  if (!Number.isInteger(parsedDepthHint) || parsedDepthHint <= 0) {
    throw new Error("--depthHint must be a positive integer");
  }
  depthHint = parsedDepthHint;
}

const tool = createChangesLoadTool(createShell());
const output = await tool.execute(
  {
    base: values.base,
    head: values.head,
    depthHint,
    diff: values.diff,
  },
  createToolContext(),
);

process.stdout.write(`${output}\n`);
