### Push Branch

- If `<current-branch>` is not defined, run `git branch --show-current` and store the trimmed result as `<current-branch>`
- Run `git push` and use its output as the source of truth
- If the current branch has no upstream, retry with `git push -u origin <current-branch>`
- After a successful push, store whether commits were transferred as `<push-status>` and the reported destination as `<push-target>`
- If push fails, STOP and report the push error
