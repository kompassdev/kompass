## Goal

Review code changes and provide actionable feedback with a grade and risk assessment.

## Additional Context

Use `<additional-context>` to prioritize specific risks, feature areas, or related concerns while reviewing `<changes>`.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` equals "uncommitted", store as `<scope>` = "uncommitted"
- If `<arguments>` looks like a branch reference (e.g., "main", "origin/main"), store as `<base>`
- If `<arguments>` provides review focus areas or related context, store it as `<additional-context>`
- Otherwise, leave optional placeholders undefined

### Load Changes

Call `changes_load`:
- If `<base>` is defined: pass `base: <base>`
- Otherwise: call with no parameters (auto-detects uncommitted vs branch comparison)

Store the result as `<changes>`.
- If `<changes>.branch` is available, store it as `<current-branch>`

If `<changes>.comparison` is "uncommitted":
- Treat as reviewing uncommitted changes
- Store `uncommitted changes` as `<scope-description>`

If `<changes>.comparison` is not "uncommitted":
- Treat as reviewing branch changes
- If `<base>` is defined and `<current-branch>` is available, store `<current-branch> -> <base>` as `<scope-description>`
- Otherwise, store `<changes>.comparison` as `<scope-description>`

### Review Changes

Following the reviewer agent guidance:
1. Read each changed file for full context in the current session before drafting findings
2. Analyze for bugs, security issues, and correctness problems
3. Formulate findings ordered by impact
4. Store the overall rating as `<star-rating>`, the top-line conclusion as `<short-verdict>`, and the severity counts as `<critical>`, `<high>`, `<medium>`, and `<low>`
5. Store the total number of findings as `<count>`

While reading files:
- Load any relevant nested `AGENTS.md` in the current session before applying review criteria
- For deleted files, inspect prior contents from git because `changes_load` does not provide full deleted-file contents
- Use a helper agent only if the changed-file set is too large to review comfortably in one session after the changed paths are already known

### Output

When the review is complete, display:
```
Review complete for <scope-description>

- Grade: <star-rating>
- Verdict: <short-verdict>
- Findings: <count> total (<critical> critical, <high> high, <medium> medium, <low> low)

No additional steps are required.
```
