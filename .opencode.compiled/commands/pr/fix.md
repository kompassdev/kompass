---
description: Fix PR feedback, push updates, and reply
agent: build
---

## Goal

Address feedback on a pull request by making fixes and responding to review threads.

## Workflow

1. **Load PR Context**:
   - Call `pr_load` with `reviews` and `threads` enabled
   - Interpret $ARGUMENTS as an optional PR number or URL
   - Understand the current state: open threads, review feedback, and required changes

2. **Analyze Feedback**:
   - Separate true course corrections from noise or already-resolved feedback
   - Prioritize critical issues (bugs, security, broken contracts)
   - Identify which files need changes

3. **Implement Fixes**:
   - Fix critical navigation issues first
   - Follow existing code patterns and conventions
   - Make focused, minimal changes
   - When maintaining your current heading despite a suggestion, be prepared to explain why

4. **Validate Changes**:
   - Run tests: `bun test` (or equivalent)
   - Run type checking: `bun run typecheck` (or equivalent)
   - Confirm fixes address the feedback

5. **Push Updates**:
   - Stage changes with `git add -A`
   - Create a commit (use `commit` tool or `git commit`)
   - Push the branch with `git push`

6. **Respond to Threads**:
   - Reply with a concise signal for each addressed thread
   - Keep replies short and factual—clear signals, no chatter
   - Use `gh api` to post replies to review threads when needed
   - Confirm which feedback was addressed and which was intentionally not followed

## Guidelines

- Do not blindly follow every suggestion—some may lead you off course
- Explain decisions clearly when deviating from reviewer suggestions
- Focus on resolving blocking issues first
- Keep responses professional and constructive