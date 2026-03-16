## Goal

Create a pull request for the current branch, handling the entire workflow from change detection to PR submission.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- **Branch name**: If `<arguments>` looks like a branch reference (e.g., "main", "origin/develop"), store it as `<base>`
- **Ticket directive**: If `<arguments>` clearly requests ticket auto-creation, store `<ticket-mode>` as `auto`
- **Ticket reference**: If `<arguments>` includes a ticket URL or clear ticket reference, store it as `<ticket-url>` and store `<ticket-mode>` as `provided`
- **Skip ticket**: If `<arguments>` clearly says to skip ticket mention, store `<ticket-mode>` as `skip`
- **Additional context**: If `<arguments>` provides guidance (focus areas, related issues, notes), store it as `<additional-context>`
- **Empty**: If no `<arguments>` provided, proceed with defaults

### Load & Analyze Changes

{{change-summary rules="- If `<base>` is defined: call `changes_load` with the `base` parameter set to `<base>`
- Otherwise: call `changes_load` with no parameters
- Never pass `uncommitted: true` in this command"}}

- Store the loaded change result as `<changes>`
- Store the current branch from `<changes>` as `<current-branch>` when it is available
- Store the effective base branch as `<resolved-base>` by preferring `<base>` when it was provided, otherwise using the base branch implied by `<changes>.comparison`

### Check Blockers

- If `<changes>.comparison` is "uncommitted":
  - STOP immediately
  - Report: "There are uncommitted changes. Please commit or stash them before creating a PR."
  - List the changed files from `<changes>`
  - Do NOT proceed further
- Treat this as a blocker only when `changes_load` returns `comparison: "uncommitted"` from the default call above; never force that mode during PR creation
- If `<current-branch>` equals `<resolved-base>`:
  - STOP immediately
  - Report: "You are currently on the base branch (<resolved-base>). Please checkout a feature branch before creating a PR."
  - Suggest: `git checkout -b <feature-name>`
  - Do NOT proceed further
- If `<changes>` contains no files and no commits, STOP and report that there is nothing to include in a PR

{{summarize-changes}}

### Resolve Ticket

- If `<ticket-mode>` is already `auto`, `provided`, or `skip`, do not ask a follow-up question
- Otherwise, if the `question` tool is available, this step is mandatory:
  - Ask exactly one `question` before creating a ticket or PR
  - Do not infer a default ticket mode
  - Do not proceed to `Prepare Ticket Reference`, `Push Branch`, or `Create PR` until the answer is resolved
  - Ask with:
    - header `Provide Ticket`
    - question `Provide Ticket`
    - options:
      - `Automatically Create` - create a fresh ticket from the summarized branch work
      - `Skip` - mention `SKIPPED` in the PR body
    - custom answers enabled so the user can paste a ticket URL or ticket reference directly
- Otherwise, if the `question` tool is not available:
  - Do not ask a follow-up question
  - Store `<ticket-mode>` as `skip`
  - Store `<ticket-url>` as `SKIPPED`
  - Continue without blocking
- Normalize the result into one of these paths:
  - `Automatically Create` => `<ticket-mode>` = `auto`
  - custom ticket URL or reference => `<ticket-mode>` = `provided` and store the answer as `<ticket-url>`
  - `Skip` => `<ticket-mode>` = `skip`

### Prepare Ticket Reference

When `<ticket-mode>` is `auto`, create the ticket before creating the PR:
{{changes-summary}}
- Use `ticket_sync` with `refUrl` unset
- Store the created issue reference or URL as `<ticket-url>`

Otherwise:
- If `<ticket-mode>` is `provided`, use the provided ticket value as `<ticket-url>`
- If `<ticket-mode>` is `skip`, store the literal `SKIPPED` as `<ticket-url>`

### Push Branch

Run `git push` and use its output as the source of truth.

- Do not run extra git commands just to decide whether to push
- If the branch was pushed during this run, report `Push: yes`
- If `git push` reports no push was needed, report `Push: no`
- If `Push: yes`, also report `Pushed: <current-branch> → origin/<current-branch>`
- Store the push status line as `<push-status>`
- When a push occurs, store the pushed ref line as `<pushed-line>`

### Create PR

Use `pr_sync` to create the pull request:
- Generate a concise title (max 70 chars) summarizing the change and store it as `<pr-title>`
- Generate a short description that briefly describes the intent and scope
- Generate a compact checklist that mirrors the same human-facing structure used for the ticket summary:
  - group delivered work into 2-4 functional or outcome-focused sections
  - use concise section names instead of generic labels like `Changes`
  - end with one `Validation` section containing reviewer-facing confirmation steps
  - do not use execution-status notes as checklist items
- Render the PR body with this exact structure by setting `body` directly:
  - `## Ticket`, followed by `<ticket-url>` on the next line
  - `## Description`, followed by the short description
  - `## Checklist`, followed by the checklist items and any subsection headings
- Use `<resolved-base>` as the base branch when it is defined
- Do NOT restate the full diff
- Keep it compact and directional
- Store the returned URL as `<pr-url>`
- If `pr_sync` reports that a PR already exists for the branch, treat the result as an existing PR
- Track whether the branch was pushed during this run and report that status in the final response

## Additional Context

Consider `<additional-context>` when analyzing changes and writing the PR description.
- Always include the `Ticket`, `Description`, and `Checklist` sections in that order.
- Use the literal `SKIPPED` when ticket mention was skipped.
- Keep the description focused on intent, not implementation details.
- Mark checklist validation items as completed if validation was performed.
- Uncommitted changes and being on the base branch block PR creation entirely.

## Output

If PR creation stops because there is nothing to include, display:
```
Nothing to include in a PR
```

When a new PR is created, display:
```
Created PR: <pr-title>

URL: <pr-url>
Branch: <current-branch> → <resolved-base>
Ticket: <ticket-url>
```

If a PR already exists for the branch, display:
```
PR already exists

URL: <pr-url>
Branch: <current-branch> → <resolved-base>
Ticket: <ticket-url>
```

After the ticket line, always include one additional line reporting push status:
```
<push-status>
```

If a push happened during this run, include one more line:
```
<pushed-line>
```
