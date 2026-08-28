### Implement The Change

- Load the repository instructions that apply to every file likely to change
- Inspect the current implementation, its callers, and its tests until the existing behavior and local conventions are clear
- Derive `<acceptance-checks>` from every explicit requirement, constraint, and approved plan item in <%= it.context %>
- Store the files and behaviors intentionally excluded from this change as `<out-of-scope>`
- Implement the smallest complete change that satisfies every item in `<acceptance-checks>` while preserving unrelated work
- Before validation, account for every item in `<acceptance-checks>` with an implementation change, an existing behavior that already satisfies it, or a concrete blocker
- Continue implementing while any item remains unaccounted for; STOP and report the blocker when an item cannot be completed without changing the approved scope
