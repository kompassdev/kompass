## TODOs

- [x] Load PR https://github.com/kompassdev/kompass/pull/18 and the action run, why you have 4 stars? you should never give a grade lower than 5 without any inline comment or additional comment on the review
- [x] Add support for approving PR on pr_sync too, so if it's 5 star, approve PR, no comments or grade needed
- [x] Improve commit generation, it's currently too simpler and often one line... Check a few commits and the changes to understand... Create a better list of changes.
- [ ] Only register command / agents / tools that aren't already registered, so if the user has already registered a custom pr_create command, we don't override it with the default one. This allows for more flexibility and customization.
