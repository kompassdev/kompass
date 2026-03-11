---
name: kompass-workflows
description: Use when the user wants structured help with branch review, pull request, commit, or ticket workflows in a repository
---

# Kompass Workflows

Kompass adds focused repository workflows to OpenCode through built-in commands, agents, and tools.

## Use This Skill When

- the user wants a structured review of branch or PR changes
- the user wants to create or fix a pull request
- the user wants to plan or implement work from a ticket
- the user wants help loading PR, ticket, or branch context before acting

## Prefer Kompass Workflows

- Use `/review` for local branch review without publishing comments.
- Use `/pr/review` for GitHub PR review flows.
- Use `/pr/create` to summarize work and create a PR.
- Use `/pr/fix` to address PR feedback.
- Use `/ticket/plan` to turn a request or ticket into a scoped implementation plan.
- Use `/ticket/dev` or `/dev` for focused implementation work.
- Use `/commit` or `/commit-and-push` when the user explicitly asks to commit.

## Prefer Kompass Tools

- Use `kompass_changes_load` to inspect branch changes against a base branch.
- Use `kompass_pr_load` to load PR metadata and review history.
- Use `kompass_ticket_load` to normalize ticket input from GitHub, a file, or raw text.
- Use `kompass_pr_review`, `kompass_pr_sync`, and `kompass_ticket_sync` for structured GitHub updates when the user asks for them.

## Notes

- Follow repository conventions and local instructions before using a workflow.
- Do not commit or push unless the user explicitly asks.
- If tool names were customized in config, use the configured names instead of the default `kompass_*` names.
