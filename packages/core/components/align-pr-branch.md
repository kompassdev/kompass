- If `<pr-branch>` is unavailable, STOP and report that the PR head branch could not be determined
<% if (it.requiresBranch) { -%>
- If `<current-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context.pr.headRefOid>`, store `<current-branch>` as `<active-branch>` and do not checkout again
- If `<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context.pr.headRefOid>`:
  - Run `gh pr checkout <pr-context.pr.number>` before <%= it.action %>
  - After checkout, store the active branch as `<active-branch>`
  - Run `git rev-parse HEAD` again and store the trimmed result as `<current-head>`
  - If checkout fails or times out, STOP and report that the PR branch could not be checked out locally; do not retry checkout unless the user explicitly asks
- Do not <%= it.scope %> until `<active-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context.pr.headRefOid>`
<% } else { -%>
- If `<current-head>` equals `<pr-context.pr.headRefOid>`, store `<current-branch>` as `<active-branch>` when `<current-branch>` is available; otherwise store `<current-head>` as `<active-branch>`. Do not checkout because the worktree is already at the PR head commit.
- If `<current-head>` differs from `<pr-context.pr.headRefOid>`:
  - Run `gh pr checkout <pr-context.pr.number>` before <%= it.action %>
  - After checkout, store the active branch as `<active-branch>`
  - Run `git rev-parse HEAD` again and store the trimmed result as `<current-head>`
  - If checkout fails or times out, STOP and report that the PR branch could not be checked out locally; do not retry checkout unless the user explicitly asks
- Do not <%= it.scope %> until `<current-head>` equals `<pr-context.pr.headRefOid>`
<% } -%>
