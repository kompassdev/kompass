## Goal

Load a ticket and its discussion, answer the user's question, and post that answer back to the ticket.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` includes a ticket reference or URL, store it as `<ticket-url>`
- Treat the remaining question or instruction as `<question>`
- If `<arguments>` includes extra focus areas, caveats, or response constraints, store them as `<additional-context>`
- If `<question>` is empty, derive it from the conversation before continuing

### Load Ticket Context

- Use `ticket_load` with `source: <ticket-url>` and `comments: true`
- Store the result as `<ticket-context>`
- If `<ticket-url>` is missing or `<ticket-context>` cannot be loaded, STOP and report that the ticket context is missing or invalid

### Draft The Answer

- Read the ticket body and comments in `<ticket-context>` to understand the request, history, and open questions
- Answer `<question>` using the ticket discussion plus any necessary repository context
- Store the response to post as `<ticket-answer>`

### Sync Ticket

- Use `ticket_sync` with:
  - `refUrl: <ticket-url>`
  - `comments: [<ticket-answer>]`
- Store the returned ticket URL as `<ticket-url>`

## Additional Context

- Use `<additional-context>` to shape tone, depth, and focus for `<ticket-answer>`
- Keep the posted answer grounded in the actual ticket discussion; do not invent missing facts
- Ask only when the ticket source or question cannot be determined reliably

## Output

If the ticket context or question cannot be determined, display:
```
Unable to answer ticket: missing ticket or question context
```

When the ticket answer is posted, display:
```
Answered ticket: <ticket-url>
```
