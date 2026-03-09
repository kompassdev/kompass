#!/usr/bin/env bun
/**
 * Compile the OpenCode adapter into standalone files.
 *
 * This script expands the shared Kompass source into concrete OpenCode command
 * and agent files so the adapter output can be reviewed without loading the
 * package at runtime.
 */

import { mkdir, writeFile, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const OUTPUT_DIR = path.resolve(PACKAGE_ROOT, ".opencode");

import {
  loadKompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "@kompassdev/core";
import { getOpenCodeToolName, prefixKompassToolReferences } from "../tool-names.ts";

async function cleanOutputDirectory() {
  try {
    await access(OUTPUT_DIR);
    await rm(OUTPUT_DIR, { recursive: true });
    console.log(`Cleaned ${path.relative(WORKSPACE_ROOT, OUTPUT_DIR)}\n`);
  } catch {
    // Directory doesn't exist, that's fine
  }
}

async function main() {
  console.log("Compiling Kompass OpenCode adapter...\n");

  // Clean output directory for fresh build
  await cleanOutputDirectory();

  // Load configuration
  const userConfig = await loadKompassConfig(WORKSPACE_ROOT);
  const config = mergeWithDefaults(userConfig);
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, config.tools.enabled);

  // Compile commands
  console.log("\nCompiling commands...");
  const compiledCommands = await resolveCommands(WORKSPACE_ROOT, { ci: false });
  console.log(`  Compiled ${Object.keys(compiledCommands).length} commands`);

  // Create output directories
  await mkdir(path.join(OUTPUT_DIR, "commands"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "agents"), { recursive: true });

  // Write compiled commands
  console.log("\nWriting compiled commands...");
  for (const [name, command] of Object.entries(compiledCommands)) {
    // Namespace path mapping: pr/create -> commands/pr/create.md
    // Commands with / separators compile to nested directories
    const parts = name.split("/");
    const filename = parts.pop() + ".md";
    const dirPath = path.join(OUTPUT_DIR, "commands", ...parts);
    const filepath = path.join(dirPath, filename);

    // Ensure directory exists
    await mkdir(dirPath, { recursive: true });

    // Generate YAML frontmatter per OpenCode spec, then append content with embedded components
    const frontmatter = YAML.stringify({
      description: command.description,
      agent: command.agent,
    });
    const content = `---\n${frontmatter}---\n\n${rewriteToolNames(command.template)}`;
    await writeFile(filepath, content);
    console.log(`  commands/${name}.md`);
  }

  // Compile agents
  console.log("\nCompiling agents...");
  const resolvedAgents = await resolveAgents(WORKSPACE_ROOT);

  for (const [agentName, agent] of Object.entries(resolvedAgents)) {
    if (!agent) continue;

    try {
      const filename = agentName + ".md";
      const filepath = path.join(OUTPUT_DIR, "agents", filename);

      // Generate YAML frontmatter with agent metadata
      const frontmatter = YAML.stringify({
        description: agent.description,
        permission: agent.permission,
      });

      const content = `---\n${frontmatter}---\n\n${rewriteToolNames(agent.prompt)}`;
      await writeFile(filepath, content);
      console.log(`  agents/${filename}`);
    } catch {
      console.warn(`  Warning: Could not load agent: ${agentName}`);
    }
  }

  // Write configuration
  console.log("\nWriting configuration...");
  const configOutput = {
    commands: {
      enabled: config.commands.enabled,
    },
    agents: {
      enabled: config.agents.enabled,
    },
    tools: {
      enabled: config.tools.enabled.map(getOpenCodeToolName),
    },
    defaults: config.defaults,
    adapters: config.adapters,
  };
  await writeFile(
    path.join(OUTPUT_DIR, "kompass.json"),
    JSON.stringify(configOutput, null, 2)
  );
  console.log("  kompass.json");

  console.log("\n✓ Compilation complete!");
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log("\nTo use the compiled OpenCode adapter:");
  console.log("  1. Copy files from packages/opencode/.opencode/commands/ to your .opencode/commands/");
  console.log("  2. Copy files from packages/opencode/.opencode/agents/ to your .opencode/agents/");
  console.log("  3. Reference packages/opencode/.opencode/kompass.json for the configuration");
}

main().catch((error) => {
  console.error("Compilation failed:", error);
  process.exit(1);
});
