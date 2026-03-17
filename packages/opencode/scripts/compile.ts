#!/usr/bin/env bun
/**
 * Compile the OpenCode adapter into standalone files.
 *
 * This script expands the shared Kompass source into concrete OpenCode command
 * and agent files so the adapter output can be reviewed without loading the
 * package at runtime.
 */

import { mkdir, writeFile, rm, access, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const OUTPUT_DIR = path.resolve(PACKAGE_ROOT, ".opencode");
const CORE_SKILLS_DIR = path.resolve(WORKSPACE_ROOT, "packages", "core", "skills");

import {
  getEnabledToolNames,
  loadKompassConfig,
  mergeWithDefaults,
  resolveAgents,
  resolveCommands,
} from "../../core/index.ts";
import {
  getConfiguredOpenCodeToolName,
  prefixKompassToolReferences,
} from "../tool-names.ts";

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
  const enabledTools = getEnabledToolNames(config.tools);
  const configuredToolNames = Object.fromEntries(
    enabledTools.map((toolName) => [
      toolName,
      getConfiguredOpenCodeToolName(toolName, config.tools[toolName].name),
    ]),
  );
  const rewriteToolNames = (input: string) => prefixKompassToolReferences(input, configuredToolNames);

  // Compile commands
  console.log("\nCompiling commands...");
  const compiledCommands = await resolveCommands(WORKSPACE_ROOT, { ci: false });
  console.log(`  Compiled ${Object.keys(compiledCommands).length} commands`);

  // Create output directories
  await mkdir(path.join(OUTPUT_DIR, "commands"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "agents"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "skills"), { recursive: true });

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
  const compiledSkillEntries = Object.fromEntries(
    [
      ...(config.skills.enabled ?? []).map((name) => [name, { enabled: true }] as const),
      ...config.skills.disabled.map((name) => [name, { enabled: false }] as const),
    ],
  );
  const compiledSkillPluginEntries = Object.fromEntries(
    [
      ...(config.skills.plugins.include ?? []).map((name) => [name, { enabled: true }] as const),
      ...config.skills.plugins.exclude.map((name) => [name, { enabled: false }] as const),
    ],
  );
  const compiledSkills = {
    ...(Object.keys(compiledSkillEntries).length > 0 ? { entries: compiledSkillEntries } : {}),
    ...(Object.keys(compiledSkillPluginEntries).length > 0
      ? {
          plugins: {
            entries: compiledSkillPluginEntries,
          },
        }
      : {}),
  };
  const configOutput = {
    shared: config.shared,
    commands: Object.fromEntries(
      Object.entries(compiledCommands).map(([name, command]) => [
        name,
        {
          enabled: true,
          ...(command.config ? command.config : {}),
        },
      ]),
    ),
    agents: Object.fromEntries(
      Object.keys(resolvedAgents).map((name) => [name, { enabled: true }]),
    ),
    tools: Object.fromEntries(
      enabledTools.map((toolName) => [
        toolName,
        {
          enabled: true,
          ...(config.tools[toolName].name ? { name: config.tools[toolName].name } : {}),
        },
      ]),
    ),
    ...(Object.keys(compiledSkills).length > 0 ? { skills: compiledSkills } : {}),
    defaults: config.defaults,
    adapters: config.adapters,
  };
  await writeFile(
    path.join(OUTPUT_DIR, "kompass.jsonc"),
    JSON.stringify(configOutput, null, 2)
  );
  console.log("  kompass.jsonc");

  try {
    await cp(CORE_SKILLS_DIR, path.join(OUTPUT_DIR, "skills"), { recursive: true });
    console.log("  skills/");
  } catch {
    console.warn("  Warning: Could not copy bundled skills");
  }

  console.log("\n✓ Compilation complete!");
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log("\nTo use the compiled OpenCode adapter:");
  console.log("  1. Copy files from packages/opencode/.opencode/commands/ to your .opencode/commands/");
  console.log("  2. Copy files from packages/opencode/.opencode/agents/ to your .opencode/agents/");
  console.log("  3. Add consumer overrides in .opencode/kompass.jsonc when needed");
}

main().catch((error) => {
  console.error("Compilation failed:", error);
  process.exit(1);
});
