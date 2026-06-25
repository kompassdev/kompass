- If `<pr-branch>` is unavailable, STOP and report that the PR head branch could not be determined
- Store the local branch as `<current-branch>` from `<worktree-context>.branch` when it is available
- Store the local HEAD commit as `<current-head>` from `<worktree-context>.headOid` when it is available
<% if (it.requiresBranch) { -%>
- If `<current-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context.pr.headRefOid>`, store `<current-branch>` as `<active-branch>` and do not checkout again
- If `<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context.pr.headRefOid>`:
  - Run `gh pr checkout <pr-context.pr.number>` before <%= it.action %>
  - Call `<%= it.config.tools.worktree_load.name %>` again and store the result as `<worktree-context>`
  - Store the local branch as `<current-branch>` from `<worktree-context>.branch` when it is available
  - Store the local HEAD commit as `<current-head>` from `<worktree-context>.headOid` when it is available
  - Store `<current-branch>` as `<active-branch>` when it is available
  - If checkout fails or times out, STOP and report that the PR branch could not be checked out locally; do not retry checkout unless the user explicitly asks
- Do not <%= it.scope %> until `<active-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context.pr.headRefOid>`
<% } else { -%>
- If `<current-branch>` equals `<pr-branch>` and `<current-head>` equals `<pr-context.pr.headRefOid>`, store `<current-branch>` as `<active-branch>` and do not checkout again
- If `<current-branch>` is available and (`<current-branch>` differs from `<pr-branch>` or `<current-head>` differs from `<pr-context.pr.headRefOid>`):
  - Run `gh pr checkout <pr-context.pr.number>` before <%= it.action %>
  - Call `<%= it.config.tools.worktree_load.name %>` again and store the result as `<worktree-context>`
  - Store the local branch as `<current-branch>` from `<worktree-context>.branch` when it is available
  - Store the local HEAD commit as `<current-head>` from `<worktree-context>.headOid` when it is available
  - Store `<current-branch>` as `<active-branch>` when it is available
  - If checkout fails or times out, STOP and report that the PR branch could not be checked out locally; do not retry checkout unless the user explicitly asks
- If `<current-branch>` is unavailable, store `<pr-context.pr.headRefOid>` as `<active-branch>` when it is available; otherwise store `<pr-branch>` as `<active-branch>`. Do not checkout from detached HEAD for read-only PR review.
- Do not <%= it.scope %> from local files unless `<current-head>` equals `<pr-context.pr.headRefOid>`; use `<active-branch>` and `<changes>` as the source of truth for the PR head diff when local HEAD differs
<% } -%>
