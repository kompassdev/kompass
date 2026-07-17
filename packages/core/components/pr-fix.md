### Load PR Changes

Call `<%= it.config.tools.changes_load.name %>` with `base: <pr-context.pr.baseRefName>`, `head: <active-branch>`, and positive `depthHint: <pr-context.pr.commitCount>` when available. Store as `<changes>`.

### Analyze And Implement Fixes

- Treat unresolved review threads, review state changes, `<actionable-work>`, and CI details in `<additional-context>` as candidate feedback
- Use `<changes>` to understand the current PR scope
- Separate true course corrections from noise, resolved feedback, and superseded feedback
- Fix critical correctness, security, contract, and required-CI issues first
- Follow existing patterns and make focused, minimal changes
- Store the modified-file count as `<changes-count>`

### Validate Fixes

- Run the most relevant available validation
<% for (const line of it.config.shared.validation) { -%>
- <%= line %>
<% } -%>
- Store details as `<validation-results>` and the outcome as `<validation-passing>` (`yes` or `no`)
- STOP before commit, push, or replies when validation fails

### Review Fixes

<% if (!it.auto) { -%>
- If `<execution-mode>` is `auto`, skip this review gate and continue to commit and push
- Present the fix summary, changed-file count, and validation results
- If changes were made, ask one `Review Fixes` question with `Go Ahead` and `Revise`; apply custom revision feedback and repeat implementation and validation until approved
- If no changes were made, ask one `Need Feedback` question with `Revise` and `Stop Here`
- STOP if approval is required but `question` is unavailable
<% } else { -%>
- Continue without an approval prompt
- If actionable work produced no changes and `<base-update>` is `already up to date`, STOP to avoid looping without progress
<% } -%>

### Commit And Push Fixes

- If fixes produced uncommitted changes, stage the focused changes and create a conventional commit
- If the base update already created a merge commit and there are no additional changes, do not create an empty commit
- Push the branch, setting its upstream when necessary
- Store push status as `<pushed>`
- STOP if commit or push fails

### Respond To Threads

- Only after commit and push succeed, use `<%= it.config.tools.pr_sync.name %>` to post short factual replies to addressed feedback
- Reply with `replies` keyed by the addressed comment IDs; use `commentBody` only for general CI feedback
- Store the number of addressed threads as `<threads-resolved>`
