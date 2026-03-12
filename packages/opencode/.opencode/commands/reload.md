---
description: Reload the current OpenCode project configuration
agent: build
---

## Goal

Reload the current OpenCode project cache.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- This command does not accept runtime arguments
- If `<arguments>` is non-empty, ignore it instead of changing behavior

### Reload Project

- Call the `kompass_reload` tool
- If the tool fails, STOP and report the kompass_reload error

## Additional Context

- Use this command when the workspace cache needs to reflect the current repository state

## Output

When kompass_reload succeeds, display:
```
Reloaded project cache
```