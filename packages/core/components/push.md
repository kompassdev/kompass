### Push Branch

- Run `git push` and use its output as the source of truth
- If the current branch has no upstream, retry with `git push -u origin <current-branch>`
- Store whether a push occurred as `<push-status>` and the successful destination as `<push-target>`
- If push fails, STOP and report the push error
