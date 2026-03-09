---
description: Bump and publish the opencode package
agent: build
---

## Goal

Bump `@kompassdev/opencode` to a new version, validate the workspace, and prepare the exact npm publish command for the user to run manually.

## Workflow

### Interpret Arguments

Store `$ARGUMENTS` as `<arguments>` and normalize it before doing any work:
- If `<arguments>` looks like an explicit semver such as `0.0.4`, store it as `<target-version>`
- If `<arguments>` is empty, inspect `packages/opencode/package.json`, read the current version, and store the next patch version as `<target-version>`
- If `<arguments>` includes extra release notes or guidance, store that as `<additional-context>`

### Update Package Version

- Read `packages/opencode/package.json`
- Update the `version` field to `<target-version>`
- Do not modify `packages/core/package.json` in this command

### Validate

Run these commands from the workspace root after updating the package version:

```bash
bun run compile
bun run typecheck
bun run test
```

- If validation fails, stop and report the failing command
- Do not publish if validation fails

### Prepare Publish Command

Do not run the publish command. Instead, prepare the package for publish and then tell the user to run this command from the workspace root:

```bash
npm publish ./packages/opencode --access public
```

- Do not attempt npm auth, browser auth, or OTP flows in this command
- Do not publish on the user's behalf

## Additional Context

Consider `<additional-context>` when choosing the release framing, but keep the actual publish flow minimal and deterministic.

## Output

When validation succeeds, display:

```
Prepared `@kompassdev/opencode@<target-version>` for publish

Validation:
- bun run compile
- bun run typecheck
- bun run test

Run:
- npm publish ./packages/opencode --access public
```

If validation is blocked, display the blocker, the attempted version, and the next action needed.
