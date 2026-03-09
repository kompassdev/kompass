---
description: Implement a ticket and create a PR
agent: build
---

## Goal

Implement a ticket and create a pull request for the completed work.

## Workflow

1. **Load Ticket**: 
   - Interpret $ARGUMENTS as the destination (ticket reference, file path, or raw request)
   - Use `ticket_load` to get your bearings and understand requirements

2. **Develop**: Follow the Development Flow to implement the changes
   ## Development Flow Navigation Guide

When implementing a request or ticket, follow this compass:

### Workflow
1. Orient yourself by loading the request from `$ARGUMENTS` or `ticket_load`
2. Survey the codebase before plotting your route
3. Navigate the implementation following local conventions
4. Validate the path with targeted checks
5. Hand off to the PR creation flow to signal arrival at the pull request

### Guidelines
- Keep context compact—pack light for the journey
- Prefer the smallest course correction that fully reaches the destination
- Surface any detours or follow-up destinations that should stay off the current route

3. **Create PR**: After validation, create the pull request
   - Push the branch if needed
   - Follow the PR creation workflow to generate title and body
   - Link to the original ticket
   - Output the PR URL