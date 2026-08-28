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

<%~ include("@dev-flow", { context: "`<ticket-context>` and `<additional-context>`" }) %>

### Validate Changes

- Run the most relevant available validation
<% for (const line of it.config.shared.validation) { -%>
- <%= line %>
<% } -%>
- Store results as `<validation-results>` and STOP if required validation fails

### Load Uncommitted Changes Once

<%~ include("@change-summary", { config: it.config, rules: "- pass `uncommitted: true` to get uncommitted changes only" }) %>
- Set `<branch-context>` to `<ticket-summary>`

<%~ include("@branch") %>

### Commit Changes

- If `<changes>` contains files:
<%~ include("@commit") %>
- Store `<commit-result>` as the created `<hash>` and `<commit-message>`
- Otherwise, store `<commit-result>` as `no new commit` and continue so previously committed ticket work can still be shipped

### Load Branch Changes

- Call `<%= it.config.tools.changes_load.name %>` with no parameters and store the result as `<changes>`
- Store `<ticket-mode>` as `provided` when `<ticket-url>` exists, otherwise `skip`

<%~ include("@pr-create", { config: it.config }) %>

### Output

If any step stops on a blocker not covered by another output, store its reason as `<reason>` and completed phases as `<completed-state>`, then display:
```
Ticket development blocked: <reason>
Completed: <completed-state>

No additional steps are required.
```

When complete, display:
```
Implemented ticket: <ticket-summary>

Validation: <validation-results>
Branch: <current-branch>
Commit: <commit-result>
PR: <pr-url>

No additional steps are required.
```
