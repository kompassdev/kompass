---
description: Remove AI code slop from current branch
agent: build
---

## Goal

Remove AI-generated code slop and inconsistencies from the branch changes.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` looks like a base branch reference, store it as `<base>`
- If `<arguments>` provides cleanup priorities, exclusions, or style guidance, store it as `<additional-context>`
- Otherwise, compare the current branch against the default base branch

### Load Changes

- Call `kompass_changes_load` to get the diff against `<base>` when defined, otherwise use the default comparison
- Store the result as `<changes>`
- Store `<changes>.comparison` as `<scope-summary>`

### Check Blockers

- If `<changes>` contains no files, STOP and report that there is no branch work to clean up

### Identify Slop

- Review `<changes>` for:
  - Extra comments that a human would not add or that clash with nearby code
  - Defensive checks or try/catch blocks that are abnormal for that area
  - Casts to `any` used to bypass type issues
  - Style inconsistencies with surrounding code
  - Unnecessary emoji usage
  - Verbose explanations where concise code would suffice
  - Boilerplate that does not match project patterns

### Clean Up

- Remove or simplify unnecessary comments
- Replace abnormal defensive patterns with idiomatic local patterns
- Fix type issues properly instead of using `any`
- Align style with the surrounding codebase
- Remove emojis unless explicitly requested
- Store the number of updated files as `<files-updated>`

### Validate

- Run the most relevant available validation for the edited work in this session
- Prefer project-native checks such as changed-area tests, linting, type checking, build verification, or other documented validation steps when they exist
- If a category of validation is not available in the project, note it explicitly instead of inventing a command
- Confirm the cleaned-up code still works correctly before committing
- Store the collected validation summary as `<validation-status>`

### Commit Changes

- Stage the cleaned files with `git add`
- Create a focused commit describing the cleanup
- Store the created commit hash as `<hash>`

## Additional Context

Use `<additional-context>` to decide which kinds of slop to prioritize and which areas should remain untouched.

## Output

If there is no branch work to clean up, display:
```
Nothing to clean for <scope-summary>

No additional steps are required.
```

When the cleanup is complete, display:
```
Cleaned branch changes for <scope-summary>

Results:
- Files updated: <files-updated>
- Validation: <validation-status>
- Commit: <hash>

No additional steps are required.
```