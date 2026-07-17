### Check PR Blockers

- Store the current branch from `<changes>` as `<current-branch>` when available
- Store `<resolved-base>` by preferring `<base>`, otherwise use the base implied by `<changes>.comparison`
- If `<changes>.comparison` is `uncommitted`, STOP and report that changes must be committed or stashed
- If `<current-branch>` equals `<resolved-base>`, STOP and report that PR creation requires a work branch
- If `<changes>` contains no files and no commits, STOP and report that there is nothing to include in a PR

<% if (it.analyze !== false) { -%>
<%~ include("@change-summary", { config: it.config, load: false }) %>
<% } -%>

### Resolve Ticket

- Preserve an already defined `<ticket-mode>` or `<ticket-url>`
- If `<ticket-url>` is defined, store `<ticket-mode>` as `provided`
- Otherwise, if ticket handling was explicitly skipped, store `<ticket-mode>` as `skip`
- Otherwise, if automatic ticket creation was requested, store `<ticket-mode>` as `auto`
- Otherwise, when `question` is available, ask exactly one `Provide Ticket` question with `Automatically Create` and `Skip` options and custom answers enabled
- When `question` is unavailable, default to `skip`
- Normalize a custom ticket reference as `<ticket-url>` with mode `provided`; never infer `skip` when the user can be asked

### Prepare Ticket Reference

When `<ticket-mode>` is `auto`:
<%~ include("@changes-summary", { config: it.config }) %>
- Use `<%= it.config.tools.ticket_sync.name %>` with `assignees: ["@me"]` and store the created issue URL as `<ticket-url>`

Otherwise, preserve the provided `<ticket-url>` or store the literal `SKIPPED` for mode `skip`.

<%~ include("@push", { config: it.config }) %>

### Create PR

- Generate a concise title of at most 70 characters as `<pr-title>`
- Generate a compact description focused on intent and scope
- Build 2-4 outcome-focused checklist sections followed by `Validation`
- Use `<%= it.config.tools.pr_sync.name %>` to create the PR with `<resolved-base>` as `base`, `<current-branch>` as `head`, and `assignees: ["@me"]`
- Set `body` with `## Ticket`, `## Description`, and `## Checklist` in that order
- Omit review, replies, commentBody, and commitId
- Store the created or existing PR URL as `<pr-url>` and whether it already existed as `<pr-existing>`
