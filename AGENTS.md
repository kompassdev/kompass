# AGENTS.md - kompass

Guidelines for AI agents working in this repository.

## What This Is

This is a Kompass workspace with multiple packages.

- `packages/core` contains the generic workflow toolkit
- `packages/opencode` contains the OpenCode adapter

Compiled OpenCode artifacts are written to `packages/opencode/.opencode/` for review.

## When Making Changes

```bash
# Run after making code or generated-file changes in this session
bun run compile
bun run typecheck
bun run test
```

- Only run these commands after you edit files in this session.
- If you are only analyzing an existing branch, reviewing changes, or creating a PR without editing files, do not run them automatically.
- Do not regenerate `packages/opencode/.opencode/` unless you changed the source that produces it or the user explicitly asked.
- If no validation was run in the current session, say that clearly instead of implying the branch was tested.

Never edit `packages/opencode/.opencode/` directly.

## Project Structure

```text
packages/core/      # Shared commands, agents, components, tools, tests
packages/opencode/  # OpenCode adapter package
kompass.jsonc       # Local workspace config used for development
packages/opencode/.opencode/ # Generated OpenCode output for review
```

## Package Boundaries

- Put reusable workflow logic in `packages/core`
- Put OpenCode-specific SDK wiring in `packages/opencode`
- Do not make the workspace root a runtime package again

## Command Authoring

- Author command definitions in `packages/core/commands/`; treat `packages/opencode/.opencode/commands/` as generated output only
- Use `packages/core/commands/pr/create.txt` as the canonical example for command structure and tone
- Keep this section order in command docs unless a command has a strong reason not to: `## Goal`, `## Workflow`, `## Additional Context`, `## Output`
- Start `## Workflow` with `### Interpret Arguments`, and normalize `$ARGUMENTS` into named placeholders before any execution steps
- Use angle-bracket placeholders consistently for derived values and stored context, such as `<arguments>`, `<base>`, `<additional-context>`, `<pr-url>`, and define each placeholder before it is referenced later in the command
- When referring to placeholders literally in prose, always wrap them in backticks, such as `<arguments>` or `<pr-url>`; keep output examples plain when the placeholder represents substituted user-facing text
- If arguments can mean different things, explicitly disambiguate them in `### Interpret Arguments` and store each interpretation in a separate placeholder
- For orchestrator commands, separate context loading, blocker checks, delegated execution, and final reporting into distinct workflow subsections so the control flow is easy to follow
- Prefer explicit subsection names like `### Load ... Context`, `### Check Blockers`, `### Delegate ...`, and `### Mark Complete And Loop` when the command coordinates multiple phases or subagents
- Treat loader tools and provided attachments as the source of truth for orchestration inputs; avoid extra exploratory commands when an existing tool result already answers the question
- Before delegating to a subagent, state what inputs it receives, what result should be stored, and whether the workflow must stop, pause, or continue based on that result
- When a command can pause for approval or loop over repeated work, describe the resume condition and the exact cases that must STOP without mutating state
- Use `## Additional Context` for instructions about how optional guidance, related tickets, focus areas, or other stored context should influence analysis and output
- Use `## Output` to define the exact user-facing response shape, including placeholders for generated values
- Make success, blocked, and no-op outcomes explicit in `## Output` or the surrounding workflow so orchestrators report deterministic end states
- Command-specific extra sections are fine, but they should support this core structure rather than replace it

## Component Authoring

- Store reusable command fragments in `packages/core/components/`
- Create a component only when the same structure or wording is needed in multiple commands; if a section is only used once, keep it inline in the command file
- Keep components focused on repeatable building blocks, such as shared workflow steps, analysis patterns, or output scaffolding
- Components should complement command docs, not hide the command's main intent; commands should still read clearly when expanded
- When a reusable pattern emerges from existing inline text, extract it into a component rather than duplicating and drifting over time

## Testing

Use these commands when validation is required for changes you made in this session:

```bash
bun run compile
bun run typecheck
bun run test
```

Core tool tests live under `packages/core/test/`. OpenCode adapter tests live under `packages/opencode/test/`.
