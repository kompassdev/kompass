## Goal

Implement a ticket, create a branch and commit, push it, and create a pull request in one workflow.

## Additional Context

Use `<additional-context>` to refine scope and delivery. Reuse loaded change state across adjacent phases.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store the ticket reference, URL, file, or request as `<ticket-source>`
- Store extra delivery guidance as `<additional-context>`

### Load Ticket Context

<%~ include("@load-ticket", { config: it.config, source: "<ticket-source>", result: "<ticket-context>" }) %>
- Store a concise `<ticket-summary>` and canonical `<ticket-url>` when available
- STOP if ticket context cannot be loaded

### Implement Ticket

<%~ include("@dev-flow") %>
- Implement the smallest complete change for `<ticket-context>` and `<additional-context>`
- Run the most relevant available validation
<% for (const line of it.config.shared.validation) { -%>
- <%= line %>
<% } -%>
- Store results as `<validation-results>` and STOP if required validation fails

### Load Uncommitted Changes Once

<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Store the result as `<changes>` and set `<branch-context>` to `<ticket-summary>`

<%~ include("@branch") %>

### Commit Changes

- If `<changes>` contains files:
<%~ include("@commit") %>
- Otherwise, continue so previously committed ticket work can still be shipped

### Load Branch Changes

- Call `<%= it.config.tools.changes_load.name %>` with no parameters and store the result as `<changes>`
- Store `<ticket-mode>` as `provided` when `<ticket-url>` exists, otherwise `skip`

<%~ include("@pr-create", { config: it.config }) %>

### Output

When complete, display:
```
Implemented ticket: <ticket-summary>

Validation: <validation-results>
Branch: <current-branch>
Commit: <hash>
PR: <pr-url>

No additional steps are required.
```
