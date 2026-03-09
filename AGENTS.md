# AGENTS.md — opencode-compass

Guidelines for AI agents working in this repository.

## Build / Lint / Test Commands

```bash
# Run all tests
bun test

# Run a single test file
bun test test/pr-load.test.ts

# Run tests matching a pattern
bun test --test-name-pattern="normalizes threads"

# Type check without emitting
bun run typecheck        # tsc --noEmit

# Validate entry point loads
bun run check            # bun --eval "await import('./index.ts')"
```

## Runtime & Package Manager

- **Runtime**: Bun (not Node)
- **Module**: ESM (`"type": "module"`)
- **No build step**: Plain TypeScript files executed directly
- **Package files**: `bun.lock` (primary), `package-lock.json` (compatibility)

## Code Style Guidelines

### Imports

- Use `node:` prefix for Node.js built-ins: `import { readFile } from "node:fs/promises"`
- Use `.ts` extension on relative imports: `import { foo } from "./shared.ts"`
- Use `import type` for type-only imports
- Group imports: external packages first, then internal modules, then relative imports

```typescript
import type { Config } from "@opencode-ai/sdk";
import { tool } from "@opencode-ai/plugin/tool";

import { loadProjectText } from "../lib/text.ts";
import type { PluginContext, Shell } from "./shared.ts";
```

### Naming Conventions

- `camelCase` for functions, variables, properties
- `PascalCase` for types, interfaces, classes
- `kebab-case` for filenames (e.g., `changes-load.ts`, `ticket-load.ts`)
- Descriptive verb-noun function names: `createChangesLoadTool`, `parseNameStatus`

### Types

- Prefer `interface` for object shapes
- Use explicit parameter types; return types can be inferred
- Use `type` for unions and complex types
- Optional properties: `property?: Type`
- Nullable handling via `undefined` rather than `null` where possible

### Error Handling

- Shell commands use `.nothrow()` to handle errors manually
- Check `proc.exitCode !== 0` after shell operations
- Error messages: `proc.stderr.toString() || "descriptive fallback"`
- Async errors bubble up; don't catch unless handling

```typescript
const proc = await $\`git status\`.cwd(ctx.worktree).quiet().nothrow()
if (proc.exitCode !== 0) {
  throw new Error(proc.stderr.toString() || "Failed to get git status")
}
```

### Shell Operations (Bun-specific)

- Template literal syntax: `` await $\`command ${arg}\` ``
- Chain methods: `.cwd(dir)`, `.quiet()`, `.nothrow()`
- Extract output via `.text()` or `.json()`

### Tool Patterns

Tools follow a factory pattern:

```typescript
export function createXTool($: Shell) {
  return tool({
    description: "...",
    args: {
      param: tool.schema.string().optional().describe("...")
    },
    async execute(args, ctx: PluginContext) {
      // Implementation
      return stringifyJson(result)
    }
  })
}
```

### Testing

- Uses `node:test` and `node:assert/strict`
- Test files: `test/*.test.ts`
- E2E tests create real git repos in temp directories
- Mock shell commands for unit tests
- Nested `describe` blocks for grouping

```typescript
import { describe, test } from "node:test"
import assert from "node:assert/strict"

describe("feature", () => {
  test("specific behavior", async () => {
    assert.equal(actual, expected)
  })
})
```

### Formatting

- 2-space indentation
- No trailing semicolons
- Single quotes for strings, backticks for templates
- Trailing commas in multi-line objects/arrays
- Max line length: ~100-120 characters

## Project Structure

```
tools/           # Handcrafted tools (one file per tool)
lib/             # Shared loaders and utilities
commands/        # Command templates (.txt files with embedded guidance)
agents/          # Subagent prompts (reviewer.txt, planner.txt)
components/      # Reusable navigation guidance
scripts/         # Debug/development scripts
test/            # Test files
index.ts         # Plugin entry point
```

## Adding New Tools

1. Create `tools/my-tool.ts` with factory function `createMyToolTool`
2. Export from `tools/index.ts` via `toolCreators` record
3. Add to default enabled list in `lib/config.ts` if applicable
4. Create tests in `test/my-tool.test.ts`

## Plugin Compilation

- Run `bun run compile` to generate `.opencode.compiled/` with standalone files
- Compiled commands have components embedded (e.g., `{{dev-flow}}` expanded)
- Compilation is for **review purposes only**—runtime uses source files directly
- Command definitions are exported from `commands/index.ts` and imported by `scripts/compile.ts` (no duplication)
- Source templates use `.txt` extension with component placeholders; compiled output uses `.md` with YAML frontmatter
- Never manually edit files in `.opencode.compiled/`—always regenerate via `bun run compile`

## Command Templates

- Use `{{component-name}}` syntax to embed reusable components
- Components are defined in `components/*.txt` and registered in `lib/config.ts`
- Templates in `commands/*.txt` are plain text with embedded component placeholders
