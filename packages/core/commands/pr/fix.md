## Goal

Address feedback on a pull request by making fixes and responding to review threads.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a PR number (e.g., "123") or URL, store it as `<pr-ref>`
- If `<arguments>` includes extra fix guidance, scope constraints, or priorities, store it as `<additional-context>`
- If empty, leave `<pr-ref>` undefined and let `pr_load` resolve the default PR context

### Load PR Context

Use `pr_load` as the source of truth for PR selection:
- If `<pr-ref>` is defined, call `pr_load` with `pr: <pr-ref>`
- Otherwise, call `pr_load` with no arguments
- Do not run separate git or GitHub commands just to discover which PR to fix before calling `pr_load`

Store the result as `<pr-context>`.

### Analyze Feedback

Separate true course corrections from noise or already-resolved feedback:
1. Review `<pr-context.threads>` for open, unresolved conversations
2. Check `<pr-context.reviews>` for state changes (CHANGES_REQUESTED, etc.)
3. Prioritize critical issues (bugs, security, broken contracts)
4. Identify which files need changes

Do not blindly follow every suggestion—some may lead you off course.

### Implement Fixes

1. Fix critical navigation issues first
2. Follow existing code patterns and conventions
3. Make focused, minimal changes
4. When maintaining your current heading despite a suggestion, be prepared to explain why
5. Store the modified-file count as `<changes-count>`

### Validate Changes

Run the most relevant available validation for the fixes:
<% for (const line of it.config.shared.validation) { -%>
- <%= line %>
<% } -%>
- Confirm the fixes address the feedback
- Store the collected validation details as `<validation-results>`
- Store the overall validation outcome as `<validation-passing>` with value `yes` or `no`

### Push Updates

If validation passes:
1. Stage changes: `git add -A`
2. Create commit (use `commit` tool or `git commit`)
3. Push branch: `git push`
4. Store push status as `<pushed>` with value `yes` or `no`

### Respond to Threads

Reply to addressed threads:
- Keep replies short and factual—clear signals, no chatter
- Use `pr_sync` to post comments or replies:

```
# General PR comment
pr_sync refUrl="<pr-context.pr.url>" commentBody="<reply-text>"

# Reply to a specific review thread (use comment.id from threads.comments)
pr_sync refUrl="<pr-context.pr.url>" replies=[{"inReplyTo": <comment-id>, "body": "<reply-text>"}]

# Follow-up inline review comment on a specific line
pr_sync refUrl="<pr-context.pr.url>" commitId="<commit-sha>" review={"comments": [{"path": "<file-path>", "line": <line-number>, "body": "<reply-text>"}]}
```

Confirm which feedback was addressed and which was intentionally not followed.
- Store the number of resolved threads as `<threads-resolved>`

## Additional Context

Use `<additional-context>` when prioritizing which review feedback to address first and when deciding how much scope to take on in this pass.

## Output

When fixes are complete, display exactly this final completion summary and stop. Do not continue with extra analysis, planning, or follow-up tasks unless the workflow is blocked or the user asked for more:
```
PR fix complete for #<pr-context.pr.number>

- Status: complete, no additional steps needed
- Changes made: <changes-count> files modified
- Threads resolved: <threads-resolved>
- Validation passing: <validation-passing>
- Validation details: <validation-results>
- Pushed: <pushed>
```
