## Goal

Turn non-obvious session discoveries into scoped instructions for future agents.

## Additional Context

- Capture project-specific instructions that would change a future agent's behavior
- Leave facts that are obvious from repository files or command help in their source of truth
- Use `<focus-scope>` and `<additional-context>` to decide where to look more closely

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` narrows the work to a package, directory, or feature area, store it as `<focus-scope>`
- If `<arguments>` provides extra guidance about what to capture, store it as `<additional-context>`
- If `<focus-scope>` is defined, store it as `<focus-summary>`
- Otherwise, store `the current session` as `<focus-summary>`

### Review Session

- Analyze the session for discoveries, repeated failed attempts, unexpected connections, and non-obvious constraints
- Store discoveries that would change a future agent's behavior as `<candidate-learnings>`

### Identify Learnings

- Keep project-specific relationships, constraints, tool quirks, validation requirements, and files that must change together
- Exclude session details, generic advice, and facts that repository files or command help make obvious
- Store the remaining items as `<learnings>`

### Determine Documentation Scope

- Place each learning at the most specific useful level:
  - Project-wide -> root `AGENTS.md`
  - Package-specific -> `packages/foo/AGENTS.md`
  - Feature-specific -> a deeper `AGENTS.md`

### Read Existing Docs

- Read the relevant `AGENTS.md` files before editing to avoid duplication and drift
- Remove candidates already covered by existing guidance
- If `<learnings>` is empty, STOP without editing and store the reason as `<no-learning-reason>`

### Create or Update Documentation

- Co-locate each learning with related guidance at the narrowest scope where it remains true
- Write each learning as a concrete instruction with the condition that makes it relevant
- Replace stale or duplicate guidance instead of adding another version
- Keep each learning to 1-3 actionable lines and create a new file only for a real scope boundary

### Summarize Results

- Report which files were created or updated and how many learnings were added to each
- Store those summary lines as `<file-update-lines>` in the format `- <file-path>: <learning-count> learnings`

### Output

When no learning needs documentation, display:
```
No agent guidance updates needed

Reason: <no-learning-reason>

No additional steps are required.
```

When the documentation update is complete, display:
```
Documented learnings for <focus-summary>

Files updated:
<file-update-lines>

No additional steps are required.
```
