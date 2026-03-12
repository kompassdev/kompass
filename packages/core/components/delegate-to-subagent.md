- Define `<prompt>` exactly as:

<prompt>
{{param:command}}

{{param:args}}
</prompt>

- Call the Task tool with subagent `{{param:subagent}}`
- Pass `<prompt>` as the exact prompt parameter - do NOT expand, paraphrase, or modify it
- Store the subagent result as `{{param:result}}`
- Do NOT describe what the subagent will do or invent its workflow
- Do NOT add any steps beyond calling the subagent and storing its result