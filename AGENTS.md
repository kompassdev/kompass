# AGENTS.md - opencode-compass

Guidelines for AI agents working in this repository.

## What This Is

This is a Compass workspace with multiple packages.

- `packages/core` contains the generic workflow toolkit
- `packages/opencode` contains the OpenCode adapter

Compiled OpenCode artifacts are written to `packages/opencode/.opencode/` for review.

## When Making Changes

```bash
# Always run after changes
bun run compile
bun run typecheck
bun run test
```

Never edit `packages/opencode/.opencode/` directly.

## Project Structure

```text
packages/core/      # Shared commands, agents, components, tools, tests
packages/opencode/  # OpenCode adapter package
compass.json        # Local workspace config used for development
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
- If arguments can mean different things, explicitly disambiguate them in `### Interpret Arguments` and store each interpretation in a separate placeholder
- Use `## Additional Context` for instructions about how optional guidance, related tickets, focus areas, or other stored context should influence analysis and output
- Use `## Output` to define the exact user-facing response shape, including placeholders for generated values
- Command-specific extra sections are fine, but they should support this core structure rather than replace it

## Testing

```bash
bun run compile
bun run typecheck
bun run test
```

Core tool tests live under `packages/core/test/`. OpenCode adapter tests live under `packages/opencode/test/`.
