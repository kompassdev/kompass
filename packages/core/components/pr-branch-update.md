### Align Local Branch

- Store `<pr-branch>` as `<pr-context.pr.headRefName>`
- STOP if `<pr-branch>` is unavailable
- Run `gh pr checkout <pr-context.pr.number>` before inspecting or modifying code
- Store the active branch as `<active-branch>` and STOP unless it equals `<pr-branch>`

### Update Branch From Base

- Store `<base-branch>` as `<pr-context.pr.baseRefName>` and STOP if it is unavailable
- Run `git fetch origin <base-branch>`, then store `origin/<base-branch>` as `<base-ref>`
- Run `git merge-base --is-ancestor <base-ref> HEAD` to confirm whether the PR branch contains the latest base
- If the branch is behind, merge `<base-ref>` into `<active-branch>` without rebasing or force-pushing; resolve conflicts using repository context, complete the merge, push the merge commit, and store its hash as `<base-update>`
- If the branch is current, store `<base-update>` as `already up to date`
- STOP before making PR fixes if the fetch, merge, conflict resolution, or push cannot be completed safely
