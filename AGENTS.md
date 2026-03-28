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
- When you add, remove, or rename commands, agents, components, tools, adapter settings, or bundled config fields, keep every source of truth in sync in the same change:
  - runtime definitions in `packages/core`
  - bundled config in `kompass.jsonc`, `packages/core/kompass.jsonc`, and `packages/opencode/kompass.jsonc`
  - schema in `kompass.schema.json`
  - user-facing docs in `README.md` and adapter/package docs that describe the changed surface
  - generated OpenCode output under `packages/opencode/.opencode/` when the source change affects compiled artifacts
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
- Treat `packages/core/commands/index.ts`, `packages/core/lib/config.ts`, `kompass.schema.json`, the bundled `kompass.jsonc` files, and the relevant docs as a linked surface area; if one changes, verify the others still describe the same command set and config shape
- Use `packages/core/commands/pr/create.md` as the canonical example for command structure and tone
- Keep this section order in command docs unless a command has a strong reason not to: `## Goal`, `## Additional Context`, `## Workflow`
- Keep `### Output` as the final subsection inside `## Workflow`; do not use a separate top-level `## Output` section
- Start `## Workflow` with a dedicated `### Arguments` subsection that stores the raw `$ARGUMENTS` value inside literal `<arguments>` tags before any normalization
- Follow `### Arguments` with `### Interpret Arguments`, and normalize `<arguments>` into any additional named placeholders before execution steps
- Use angle-bracket placeholders consistently for derived values and stored context, such as `<arguments>`, `<base>`, `<additional-context>`, `<pr-url>`, and define each placeholder before it is referenced later in the command
- When referring to placeholders literally in prose, always wrap them in backticks, such as `<arguments>` or `<pr-url>`; keep output examples plain when the placeholder represents substituted user-facing text
- If arguments can mean different things, explicitly disambiguate them in `### Interpret Arguments` and store each interpretation in a separate placeholder
- For navigator-style commands, separate context loading, blocker checks, delegated execution, and final reporting into distinct workflow subsections so the control flow is easy to follow
- Prefer explicit subsection names like `### Load ... Context`, `### Check Blockers`, `### Delegate ...`, and `### Mark Complete And Loop` when the command coordinates multiple phases or subagents
- Treat loader tools and provided attachments as the source of truth for orchestration inputs; avoid extra exploratory commands when an existing tool result already answers the question
- Before delegating to a subagent, say what result should be stored and whether the workflow must stop, pause, or continue based on that result
- Use literal `<dispatch-command>` tags when the workflow must forward exact text as the next user message to a subagent session; `agent` is required, the block body is the exact rendered message to send, slash commands stay literal, and only placeholders inside the body should be substituted
- Do not use `<task>` blocks in command docs; author navigator delegation with `<dispatch-command>` blocks only
- When a command can pause for approval or loop over repeated work, describe the resume condition and the exact cases that must STOP without mutating state
- Use `## Additional Context` for instructions about how optional guidance, related tickets, focus areas, or other stored context should influence analysis and response formatting
- Use `### Output` as the final workflow step to define the exact user-facing response shape, including placeholders for generated values
- Make success, blocked, and no-op outcomes explicit in `### Output` or the surrounding workflow so navigator-led flows report deterministic end states
- For terminal command outcomes, prefer an explicit final line inside the output block: `No additional steps are required.`
- For one-off commands that do not orchestrate follow-up work, make every success, blocked, or no-op output explicitly terminal with that final line
- Command-specific extra sections are fine, but they should support this core structure rather than replace it

Example command structure:

```text
## Goal

Describe the command's purpose in one short paragraph.

## Additional Context

- Explain how optional guidance should influence planning or execution

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Normalize `<arguments>` into named placeholders such as `<todo-file>` or `<additional-context>`
- Define each placeholder before it is referenced later in the workflow

### Load Context

- Load the required file, ticket, or PR context
- STOP if the source of truth cannot be loaded

### Delegate Planning

<dispatch-command agent="planner">
/ticket/plan

Task: <task>
Task context: <task-context>
Additional context: <additional-context>
</dispatch-command>

- Store the result as `<plan>`
- STOP if planning is blocked or unusable

### Delegate Implementation

<dispatch-command agent="worker">
/dev

Plan: <plan>
Constraints: <additional-context>
</dispatch-command>

- STOP if implementation is blocked or incomplete

### Output

- Define the exact success, blocked, and no-op response shapes
- For terminal outcomes, end the output block with `No additional steps are required.`
```

Example delegation rule:

```text
Before delegating, write the exact `<dispatch-command ...>...</dispatch-command>` block, say what result should be stored, and whether the workflow should continue or STOP based on that result.
```

Example literal dispatch rule:

```text
Before literal command forwarding, write the exact `<dispatch-command ...>...</dispatch-command>` block, put the slash command on the first line of the body when needed, substitute placeholders only, and say what result should be stored and whether the workflow should continue or STOP based on that result.
```

## Component Authoring

- Store reusable command fragments in `packages/core/components/`
- Treat files in `packages/core/components/` as Eta partials and include them from commands with `<%~ include("@partial-name") %>`
- Pass partial-specific locals with the second `include` argument, for example `<%~ include("@change-summary", { rules: "..." }) %>`
- Create a component only when the same structure or wording is needed in multiple commands; if a section is only used once, keep it inline in the command file
- Keep components focused on repeatable building blocks, such as shared workflow steps, analysis patterns, or output scaffolding
- Components should complement command docs, not hide the command's main intent; commands should still read clearly when expanded
- When a reusable pattern emerges from existing inline text, extract it into a component rather than duplicating and drifting over time

## Template Authoring

- Command and component files render through Eta
- Use Eta syntax for conditionals and includes; do not introduce custom placeholder syntaxes
- Store shared render inputs in top-level shared config when multiple surfaces need them, for example `shared.prApprove`; keep command-specific render inputs on `commands.<name>` only when they are truly command-local
- Custom command templates are rendered through the same Eta pipeline as bundled templates

## Testing

Use these commands when validation is required for changes you made in this session:

```bash
bun run compile
bun run typecheck
bun run test
```

Core tool tests live under `packages/core/test/`. OpenCode adapter tests live under `packages/opencode/test/`.
