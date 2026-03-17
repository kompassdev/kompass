## Goal

Answer a question about the current project or codebase using the repository and available context.

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- Treat `<arguments>` as `<question>`
- If `<arguments>` includes explicit focus areas, files, or constraints, store them as `<additional-context>`
- If `<question>` is empty, derive it from the conversation before continuing

### Load Answering Context

- Use the repository, conversation context, and relevant tools to gather only the code or project details needed to answer `<question>`
- Store the important findings as `<answer-context>`
- If `<question>` cannot be determined, STOP and report that the question is missing

### Answer The Question

- Answer `<question>` directly using `<answer-context>`
- Prefer concrete, code-grounded answers over generic guidance
- Include file references when they materially help the answer
- Keep the response concise unless the question requires more detail

## Additional Context

- Use `<additional-context>` to prioritize the most relevant files, subsystems, or concerns
- Ask only when the question cannot be determined from `<arguments>` and the conversation

## Output

If the question cannot be determined, display:
```
Unable to answer: missing question
```

When the answer is ready, display the answer directly.
