---
description: Bump and publish the opencode package
agent: build
---

## Goal

Bump `@kompassdev/opencode` to a new version, validate the workspace, and publish the package to npm.

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

### Publish

Publish the package from the workspace root:

```bash
npm publish ./packages/opencode --access public
```

- Use the command output as the source of truth
- If npm reports the version already exists, stop and report that `packages/opencode/package.json` needs a new version
- If npm requires browser auth or OTP confirmation, stop and report exactly that

## Additional Context

Consider `<additional-context>` when choosing the release framing, but keep the actual publish flow minimal and deterministic.

## Output

When publish succeeds, display:

```
Published `@kompassdev/opencode@<target-version>`

Validation:
- bun run compile
- bun run typecheck
- bun run test
```

If publish is blocked, display the blocker, the attempted version, and the next action needed.
