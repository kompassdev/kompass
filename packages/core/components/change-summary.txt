#### Step 1: Load Changes
- call `changes_load`
{{param:rules}}
- Store the returned result as `<changes>`
- Use `<changes>` as the source of truth; no additional git analysis commands are needed

#### Step 2: Analyze Files
- Review the paths, statuses, and diffs from `<changes>`
- Identify the nature of changes (added, modified, deleted)
- Note lines added/removed per file

#### Step 3: Group and Summarize
- Group related changes into logical themes
- Summarize the "what" and "why" (not the "how")
