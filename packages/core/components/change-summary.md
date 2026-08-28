<% if (it.load !== false) { -%>
#### Load Changes

- Call `<%= it.config.tools.changes_load.name %>`
<%= it.rules ?? "" %>
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect every deferred diff directly using the returned comparison and changed paths before summarizing
<% } -%>
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth for the comparison, branches, commits, changed paths, and diffs
- For a branch comparison, limit the work scope to `<changes>.commits`; use paths and diffs to explain those commits, not to import work from the base branch
- Read a changed source file when its diff does not establish its purpose or behavioral effect
- Group the work into `<change-themes>` by delivered behavior or purpose, then store a concise "what" and "why" summary as `<change-summary>`
- Account for every changed path under one theme or identify it as generated, supporting, or non-behavioral before finishing the summary
- Base every theme on commit or diff evidence rather than the branch name
