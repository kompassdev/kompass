#!/usr/bin/env bun
/**
 * Compile the opencode-compass plugin into standalone files
 * 
 * This script processes the plugin configuration and creates actual files
 * that represent what the plugin does, without requiring the plugin itself.
 * 
 * Output structure:
 * - compiled/commands/*.md - Fully expanded command prompts with YAML frontmatter
 * - compiled/agents/*.md - Agent definitions
 * - compiled/config.json - Complete configuration
 */

import { mkdir, writeFile, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, ".opencode.compiled");

// Import the actual definitions from the plugin
import { loadCompassConfig, mergeWithDefaults, type AgentDefinition } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";
import { embedComponents } from "../lib/components.ts";
import { commandDefinitions } from "../commands/index.ts";
import { getAgentDefinitions } from "../agents/index.ts";

async function loadComponents(componentPaths: Record<string, string>): Promise<Record<string, string>> {
  const components: Record<string, string> = {};

  for (const [name, componentPath] of Object.entries(componentPaths)) {
    try {
      components[name] = await loadProjectText(componentPath);
    } catch {
      console.warn(`Warning: Component not found: ${componentPath}`);
    }
  }

  return components;
}

async function compileCommands(
  config: ReturnType<typeof mergeWithDefaults>,
  components: Record<string, string>,
): Promise<Record<string, { description: string; agent: string; content: string }>> {
  const compiled: Record<string, { description: string; agent: string; content: string }> = {};
  
  for (const name of config.commands.enabled) {
    const definition = commandDefinitions[name];
    if (!definition) {
      console.warn(`Warning: Unknown command: ${name}`);
      continue;
    }
    
    const templatePath = config.commands.templates[name] || definition.templatePath;
    
    try {
      const rawTemplate = await loadProjectText(templatePath);
      // Only embed components if using default template
      const content = config.commands.templates[name]
        ? rawTemplate
        : embedComponents(rawTemplate, components);
      
      compiled[name] = {
        description: definition.description,
        agent: definition.agent,
        content,
      };
    } catch (error) {
      console.warn(`Warning: Could not load template for ${name}: ${templatePath}`);
    }
  }
  
  return compiled;
}

async function cleanOutputDirectory() {
  try {
    await access(OUTPUT_DIR);
    // Remove recursively if exists
    await rm(OUTPUT_DIR, { recursive: true });
    console.log("Cleaned existing output directory\n");
  } catch {
    // Directory doesn't exist, that's fine
  }
}

async function main() {
  console.log("Compiling opencode-compass plugin...\n");
  
  // Clean output directory for fresh build
  await cleanOutputDirectory();
  
  // Load configuration
  const userConfig = await loadCompassConfig(PROJECT_ROOT);
  const config = mergeWithDefaults(userConfig);
  
  // Load components
  console.log("Loading components...");
  const components = await loadComponents(config.components.paths);
  console.log(`  Loaded ${Object.keys(components).length} components`);
  
  // Compile commands
  console.log("\nCompiling commands...");
  const compiledCommands = await compileCommands(config, components);
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
    const content = `---\n${frontmatter}---\n\n${command.content}`;
    await writeFile(filepath, content);
    console.log(`  commands/${name}.md`);
  }
  
  // Compile agents
  console.log("\nCompiling agents...");
  const agentDefinitions = getAgentDefinitions(config);
  
  for (const agentName of config.agents.enabled) {
    const agent = agentDefinitions[agentName];
    if (!agent) continue;
    
    try {
      const promptContent = await loadProjectText(agent.promptPath);
      const filename = agentName + ".md";
      const filepath = path.join(OUTPUT_DIR, "agents", filename);
      
      // Generate YAML frontmatter with agent metadata
      const frontmatter = YAML.stringify({
        description: agent.description,
        permission: agent.permission,
      });
      
      const content = `---\n${frontmatter}---\n\n${promptContent}`;
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
      enabled: config.tools.enabled,
    },
    defaults: config.defaults,
  };
  await writeFile(
    path.join(OUTPUT_DIR, "config.json"),
    JSON.stringify(configOutput, null, 2)
  );
  console.log("  config.json");
  
  console.log("\n✓ Compilation complete!");
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log("\nTo use without the plugin:");
  console.log("  1. Copy files from .opencode.compiled/commands/ to your .opencode/commands/");
  console.log("  2. Copy files from .opencode.compiled/agents/ to your .opencode/agents/");
  console.log("  3. Reference .opencode.compiled/config.json for the configuration");
}

main().catch((error) => {
  console.error("Compilation failed:", error);
  process.exit(1);
});
