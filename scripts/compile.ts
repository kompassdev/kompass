#!/usr/bin/env bun
/**
 * Compile the opencode-compass plugin into standalone files
 * 
 * This script processes the plugin configuration and creates actual files
 * that represent what the plugin does, without requiring the plugin itself.
 * 
 * Output structure:
 * - compiled/commands/*.md - Fully expanded command prompts
 * - compiled/agents/*.md - Agent definitions
 * - compiled/config.json - Complete configuration
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, ".opencode.compiled");

// Import the actual definitions from the plugin
import { loadCompassConfig, mergeWithDefaults } from "../lib/config.ts";
import { loadProjectText } from "../lib/text.ts";

const commandDefinitions: Record<string, { description: string; agent: string; templatePath: string }> = {
  "pr/create": {
    description: "Summarize branch work and create a PR",
    agent: "build",
    templatePath: "commands/pr/create.txt",
  },
  "pr/review": {
    description: "Review the current PR and publish review feedback",
    agent: "reviewer",
    templatePath: "commands/pr/review.txt",
  },
  "pr/fix": {
    description: "Fix PR feedback, push updates, and reply",
    agent: "build",
    templatePath: "commands/pr/fix.txt",
  },
  "ticket/plan": {
    description: "Plan work from a request and create a ticket",
    agent: "planner",
    templatePath: "commands/ticket/plan.txt",
  },
  "ticket/dev": {
    description: "Implement a ticket and create a PR",
    agent: "build",
    templatePath: "commands/ticket/dev.txt",
  },
  review: {
    description: "Review branch changes without publishing comments",
    agent: "reviewer",
    templatePath: "commands/review.txt",
  },
  dev: {
    description: "Implement a request and create a PR",
    agent: "build",
    templatePath: "commands/dev.txt",
  },
  commit: {
    description: "Commit current changes with a message",
    agent: "build",
    templatePath: "commands/commit.txt",
  },
  "commit-and-push": {
    description: "Commit and push current changes",
    agent: "build",
    templatePath: "commands/commit-and-push.txt",
  },
  learn: {
    description: "Extract learnings from session to AGENTS.md files",
    agent: "build",
    templatePath: "commands/learn.txt",
  },
  rmslop: {
    description: "Remove AI code slop from current branch",
    agent: "build",
    templatePath: "commands/rmslop.txt",
  },
};

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

function embedComponents(template: string, components: Record<string, string>): string {
  return template.replace(/\{\{([\w-]+)\}\}/g, (match, name) => {
    if (components[name]) {
      return components[name];
    }
    console.warn(`Warning: Component not found: ${name}`);
    return match;
  });
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

async function main() {
  console.log("Compiling opencode-compass plugin...\n");
  
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
    const filename = name.replace(/\//g, "-") + ".md";
    const filepath = path.join(OUTPUT_DIR, "commands", filename);
    const content = `# ${name}\n\n**Agent:** ${command.agent}\n\n**Description:** ${command.description}\n\n---\n\n${command.content}`;
    await writeFile(filepath, content);
    console.log(`  commands/${filename}`);
  }
  
  // Copy agent prompts
  console.log("\nCopying agent definitions...");
  for (const agentName of config.agents.enabled) {
    const agent = config.agents[agentName as keyof typeof config.agents];
    if (!agent || typeof agent !== "object" || !("promptPath" in agent)) continue;
    
    try {
      const promptContent = await loadProjectText(agent.promptPath);
      const filename = agentName + ".md";
      const filepath = path.join(OUTPUT_DIR, "agents", filename);
      const content = `# ${agentName}\n\n**Description:** ${agent.description}\n\n**Permissions:** ${JSON.stringify(agent.permission)}\n\n---\n\n${promptContent}`;
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
