## Goal

Implement a feature or fix based on a ticket or request, then prepare for PR creation.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a ticket reference, URL, or file path, store it as `<request-source>`
- If `<arguments>` contains direct implementation guidance, store it as `<request>`
- If `<arguments>` includes extra constraints, focus areas, or notes, store them as `<additional-context>`
- If empty, derive the request from the conversation

### Load Request Context

- If `<request-source>` is defined, load it with `ticket_load` and store the result as `<request-context>`
- Otherwise, treat `<request>` as `<request-context>`
- If `<request-context>` cannot be determined, STOP and report that the implementation request is missing

### Orient Request

- Summarize the goal, constraints, and acceptance criteria from `<request-context>` before making changes
- Store that summary as `<request-summary>`

{{dev-flow}}

### Validate Changes

- Run the required validation commands for edits made in this session:
  - `bun run compile`
  - `bun run typecheck`
  - `bun run test`
- Store the results as `<compile-status>`, `<typecheck-status>`, and `<test-status>`

### Prepare PR Handoff

- Gather the key themes, tradeoffs, and validation results needed for the PR description
- Store that handoff material as `<pr-handoff>`
- Store the current branch name as `<branch>`
- Do not create the pull request in this command; stop when the branch is ready for `pr/create`

## Additional Context

Use `<additional-context>` to refine priorities, scope, and tradeoffs while implementing `<request-context>`.

## Output

When the implementation is ready for PR creation, display:
```
Implementation ready: <request-summary>

Validation:
- Compile: <compile-status>
- Typecheck: <typecheck-status>
- Test: <test-status>

Next: create a PR for <branch>
```
