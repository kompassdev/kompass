<% if (it.load !== false) { -%>
#### Load Changes

- call `<%= it.config.tools.changes_load.name %>`
<%= it.rules ?? "" %>
- Store the returned result as `<changes>`
- If `<changes>.deferredDiffs` is present, inspect the needed deferred diffs directly one file at a time using the returned comparison and changed paths
<% } -%>
#### Analyze And Summarize Changes

- Use `<changes>` as the source of truth; do not run additional git commands to rediscover its comparison
- Note the comparison mode, base branch, and current branch from `<changes>`
- When `<changes>.comparison` is not `uncommitted`, treat `<changes>.commits` as the authoritative scope of work: only summarize commits ahead of the resolved base branch
- Review commit messages when available to understand the delivery narrative
- Review paths, statuses, line counts, and diffs from `<changes>` as file-level context for the commits in scope
- Read only the most relevant changed source files when the diff does not provide enough context
- Identify the nature of changes (added, modified, deleted)
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
- Do not infer scope from branch names or describe work that exists only on the base branch or outside the commits ahead of base
