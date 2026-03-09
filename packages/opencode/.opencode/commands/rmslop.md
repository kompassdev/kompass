---
description: Remove AI code slop from current branch
agent: build
---

## Goal

Remove AI-generated code slop and inconsistencies from the branch changes.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>`, then normalize it:
- If `<arguments>` looks like a base branch reference, store it as `<base>`
- If `<arguments>` provides cleanup priorities, exclusions, or style guidance, store it as `<additional-context>`
- If empty, compare the current branch against the default base branch

### Load Changes

- Call `changes_load` to get the diff against `<base>` when defined, otherwise use the default comparison
- Store the result as `<changes>`

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

### Validate

- Run the relevant validation commands for the affected area
- Confirm the cleaned-up code still works correctly before committing

### Commit Changes

- Stage the cleaned files with `git add`
- Create a focused commit describing the cleanup

## Additional Context

Use `<additional-context>` to decide which kinds of slop to prioritize and which areas should remain untouched.

## Output

When the cleanup is complete, display:
```
Cleaned branch changes for <scope-summary>

Results:
- Files updated: <count>
- Validation: <status>
- Commit: <hash>
```