#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "..", "..");
const coreRoot = path.join(workspaceRoot, "packages", "core");
const workspaceReadme = path.join(workspaceRoot, "README.md");
const packageReadme = path.join(packageRoot, "README.md");

const runtimeDirs = ["agents", "commands", "components"] as const;
const bundleExternals = ["@opencode-ai/plugin", "@opencode-ai/plugin/tool"] as const;
const bundleArgs = [
  "build",
  "./plugin.ts",
  "--outdir",
  "./dist",
  "--target",
  "node",
  "--format",
  "esm",
  ...bundleExternals.flatMap((pkg) => ["--external", pkg]),
];

async function buildBundle() {
  const child = spawn("bun", bundleArgs, {
    cwd: packageRoot,
    stdio: "inherit",
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function copyRuntimeText() {
  for (const dir of runtimeDirs) {
    const destination = path.join(packageRoot, dir);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    await cp(path.join(coreRoot, dir), destination, { recursive: true });
  }
}

async function syncReadme() {
  await cp(workspaceReadme, packageReadme);
}

await buildBundle();
await copyRuntimeText();
await syncReadme();
