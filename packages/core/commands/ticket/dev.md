## Goal

Implement a ticket and create a pull request for the completed work.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Interpret `<arguments>` as `<ticket-source>` (ticket reference, URL, file path, or raw request)
- If `<arguments>` includes extra delivery guidance, scope constraints, or notes, store them as `<additional-context>`
- If `<ticket-source>` is empty, derive it from the conversation before continuing

### Load Ticket Context

- Use `ticket_load` with `<ticket-source>` to understand the requirements
- Store the result as `<ticket-context>`
- Store the ticket reference for PR creation as `<ticket-ref>` by preferring the original reference, otherwise using the canonical ticket URL from `<ticket-context>` when one is available, otherwise using `SKIPPED`
- Store a concise ticket summary as `<ticket-summary>`
- If `<ticket-context>` cannot be loaded, STOP and report that the ticket source is missing or invalid

<%~ include("@dev-flow") %>

### Validate Changes

- Run the required validation commands for edits made in this session:
  - `bun run compile`
  - `bun run typecheck`
  - `bun run test`
- Store the results as `<compile-status>`, `<typecheck-status>`, and `<test-status>`

### Delegate PR Creation

- The subagent receives `<ticket-ref>`, `<ticket-context>`, and `<additional-context>`
- Define `<prompt>` as:

<prompt>
/pr/create

Ticket reference: <ticket-ref>
Ticket context: <ticket-context>
Additional context: <additional-context>
</prompt>

- Call subagent `@general` with `<prompt>`
- Do not paraphrase or prepend extra text
- Store the subagent result as `<pr-result>`
- If `<pr-result>` is blocked or incomplete, STOP and report the PR blocker
- Otherwise, continue and store the resulting PR URL as `<pr-url>`

## Additional Context

Use `<additional-context>` to refine scope, sequencing, and tradeoffs while implementing `<ticket-context>`.

## Output

When the ticket work is complete, display:
```
Implemented ticket: <ticket-summary>

PR: <pr-url>
Validation:
- Compile: <compile-status>
- Typecheck: <typecheck-status>
- Test: <test-status>
```
