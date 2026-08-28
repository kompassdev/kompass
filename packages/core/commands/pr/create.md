## Goal

Create a pull request for the current branch from its committed changes.<% if (it.inline) { %> Run in the invoking session while loading the final branch comparison as authoritative state.<% } %>

## Additional Context

Use `<additional-context>`<% if (it.inline) { %> and relevant invoking-session context<% } %> when writing the PR. Include `Ticket`, `Description`, and `Checklist` sections in that order, and use `SKIPPED` when ticket mention is skipped.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Store a branch reference as `<base>`
- Store ticket auto-creation as `<ticket-mode>` = `auto`, an explicit ticket reference as `<ticket-url>`, or an explicit skip as `<ticket-mode>` = `skip`
- Store remaining guidance as `<additional-context>`

### Load And Analyze Changes

<% if (it.inline) { -%>
- Retain the authoritative branch comparison load even though this command runs in the invoking session; do not infer the final base, commit scope, or diff from session memory
<% } -%>
<%~ include("@change-summary", { config: it.config, rules: "- If `<base>` is defined, pass it as `base`; otherwise call the tool with no parameters\n- Never pass `uncommitted: true`" }) %>

<%~ include("@pr-create", { config: it.config, analyze: false }) %>

### Output

If any step stops on a blocker not covered by another output, store its reason as `<reason>` and completed phases as `<completed-state>`, then display:
```
PR creation blocked: <reason>
Completed: <completed-state>

No additional steps are required.
```

When complete, display:
```
Created PR: <pr-title>

URL: <pr-url>
Branch: <current-branch> -> <resolved-base>
Ticket: <ticket-url>
Push: <push-status>

No additional steps are required.
```

If `<pr-existing>` is true, replace the first line with `PR already exists`.
