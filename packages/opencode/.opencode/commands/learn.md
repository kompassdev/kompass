---
description: Extract learnings from session to AGENTS.md files
agent: build
---

## Goal

Extract non-obvious learnings from this session and document them appropriately.

## Workflow

1. **Review Session**: Analyze for discoveries, errors that took multiple attempts, unexpected connections

2. **Identify Learnings** (non-obvious only):
   - Hidden relationships between files or modules
   - Execution paths that differ from how code appears
   - Non-obvious configuration, env vars, or flags
   - Debugging breakthroughs when error messages were misleading
   - API/tool quirks and workarounds
   - Build/test commands not in README
   - Architectural decisions and constraints
   - Files that must change together
   - Environment-specific behaviors

3. **Determine Scope**: For each learning, identify which directory it applies to:
   - Project-wide → root AGENTS.md or CONTRIBUTING.md
   - Package/module-specific → packages/foo/AGENTS.md
   - Feature-specific → src/auth/AGENTS.md or inline comments

4. **Read Existing Docs**: Check AGENTS.md files at relevant levels to avoid duplication

5. **Create/Update Documentation**:
   - Add learnings at the most specific level
   - Keep entries to 1-3 lines per insight
   - Be concise and actionable

6. **Summarize**: Report which files were created/updated and how many learnings per file

## Guidelines

- Document non-obvious discoveries only
- Skip obvious facts, standard behavior, and already-documented items
- Avoid verbose explanations and session-specific details
- Place learnings as close to relevant code as possible
- AGENTS.md files can exist at any level—most specific one applies

$ARGUMENTS