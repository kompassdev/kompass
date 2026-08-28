### Interpret Arguments

- If `<arguments>` looks like a ticket reference or URL, store it as `<ticket-url>`
- Otherwise, treat `<arguments>` as `<request>`
- If `<arguments>` includes planning focus areas, constraints, or notes beyond the main request, store them as `<additional-context>`
- If no `<arguments>` are provided, derive the current request from the conversation and store it as `<request>`

### Load Planning Context

- If `<ticket-url>` is defined:
<%~ include("@load-ticket", { config: it.config, source: "<ticket-url>", result: "<planning-context>", comments: true }) %>
- Otherwise, treat the relevant request and conversation context as `<planning-context>`
- If `<planning-context>` is empty or missing, STOP and report that planning context could not be determined

### Interpret Planning Context

- Treat ticket providers generically unless `<planning-context>` requires provider-specific behavior
- From `<planning-context>` and `<additional-context>`, derive:
  - `<planning-objective>` - the current planning task or request
  - `<operative-constraints>` - earlier context that still applies
  - `<proposed-technical-direction>` - technical details already proposed in the discussion
  - `<open-questions>` - only the issues that are still unresolved
- Use the current request to determine `<planning-objective>`
- Do not discard earlier comments when they still define constraints, business rules, implementation decisions, migration rules, naming, sequencing, or scoping limits
- Ask one focused question only when an unresolved issue prevents a reliable plan

### Inspect Repo Context

- For a technical request with repository access, inspect the implementation, contracts, configuration, and tests needed to verify current behavior and `<proposed-technical-direction>`
- Store unverified material claims as `<planning-gaps>` instead of presenting them as facts

### Shape the Plan

- Turn `<planning-objective>`, `<operative-constraints>`, `<proposed-technical-direction>`, `<open-questions>`, and repo findings into:
  - `<plan-title>` - a short, useful title
  - `<plan-description>` - a brief description of the intended outcome, scope, important constraints, and material technical direction
  - `<requirement-items>` - concise requirement checklist items
  - `<validation-items>` - validation checklist items
- Preserve good technical details from the ticket or conversation when they are valid
- Improve incomplete technical details when repo inspection provides a better grounded direction
- Do not replace material technical guidance with generic outcome language
- Avoid placeholder-like labels or awkward title formats such as `Ticket`, `Description`, or `Ticket : Description`
- Before finishing, account for every item in `<operative-constraints>` and every resolved item in `<open-questions>` in the description or a requirement item
- Give every requirement at least one validation item that would prove it works, combining checks only when one check genuinely covers several requirements
