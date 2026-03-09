# AGENTS.md — opencode-compass

Guidelines for AI agents working in this repository.

## What This Is

This is an **opencode plugin** that provides tools and commands for compass navigation patterns. It compiles templates into `.opencode.compiled/` for review, but runtime always uses source files.

## When Making Changes

```bash
# Always run after changes
bun run compile    # Regenerates .opencode.compiled/
bun run typecheck  # Verify types
bun test          # Run tests
```

**Never edit files in `.opencode.compiled/` directly** — always edit source files and regenerate. Use the compiled output only to verify the result looks correct.

## Project Structure

```
tools/           # Handcrafted tools (changes_load, pr_load, etc.)
lib/             # Shared utilities
commands/        # Command templates (.txt with embedded components)
components/      # Reusable guidance snippets
agents/          # Subagent prompts
.opencode.compiled/   # Generated files (review only, never edit)
```

## Command Structure

All commands follow this pattern:

```
## Goal
What this command does in one sentence.

## Workflow

### Interpret Arguments
Store $ARGUMENTS as <arguments>:
- if <arguments> looks like a branch reference, store it as <base>
- if <arguments> provides guidance, store it as <additional-context>
- Reference the semantic variables throughout

### [Section Name]
Action-oriented instructions using the derived variables.

## Output

When the subagent completes its task, it must clearly display:
- What was created/modified (with identifiers like commit hash, PR number, etc.)
- Key details that should be visible to the user

Format:
```
<summary line of what was done>

<details>
- Identifier: <value>
- Relevant detail: <value>
```

## Components System

Components keep commands DRY by extracting reusable guidance:

**Define**: Create `components/my-component.txt` with placeholder parameters:
```
{{param:rules}}
```

**Use**: In commands, embed with parameters:
```
{{my-component rules="- Pass uncommitted: true for workspace changes"}}
```

**Multi-line parameters**: Supported with preserved newlines:
```
{{component-name rules="- Rule one
- Rule two
- Rule three"}}
```

**When to use components**:
- Repeated guidance across multiple commands (change analysis, commit patterns)
- Complex multi-step workflows that might evolve
- Anything that benefits from centralized updates

**When NOT to use components**:
- Command-specific logic that won't be reused
- Simple one-line instructions
- Sections that need tight coupling with command context

## changes_load Tool

- **Auto-detects uncommitted changes** — don't pass `uncommitted: true` for PR workflows
- Returns `comparison: "uncommitted"` when workspace has changes
- Only pass `uncommitted: true` when you specifically want workspace mode (commit commands)
- If result shows uncommitted changes, stop and require commit/stash

## Testing

```bash
bun test                    # All tests
bun test test/changes-load  # Single file
bun test --test-name-pattern="pattern"  # Filter
```

E2E tests create real git repos in temp directories. Unit tests mock shell commands.
