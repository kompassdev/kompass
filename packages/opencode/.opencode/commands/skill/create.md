---
description: Create a focused Agent Skill from repo context
agent: worker
---

## Goal

Create a new Agent Skill from project context and user direction, producing a focused `SKILL.md` and only the supporting files that materially improve the skill.

## Additional Context

- Favor creation over revision: create the smallest correct first version of the skill from the gathered context
- Only add support files during creation when they clearly improve execution on day one

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` contains a clear skill request, store it as `<skill-request>`
- If `<arguments>` contains an explicit skill name, slug, or desired folder name, store it as `<requested-name>`
- If `<arguments>` includes supporting context such as file paths, URLs, ticket references, or existing examples, store them as `<context-sources>`
- If `<arguments>` includes constraints, audience, tools, or notes, store them as `<additional-context>`
- If `<skill-request>` is still missing, derive it from the conversation
- If the request still cannot be determined, STOP and report that skill direction is required

### Load Starting Context

- Inspect the repository for existing skills, skill roots, and nearby conventions before creating anything
- If the repo already uses one clear skill root, store it as `<skill-root>`
- Otherwise, store `.agents/skills` as `<skill-root>`
- Read only the relevant existing skills, docs, scripts, and project artifacts needed to ground the new skill
- If an existing skill already covers the same scope and the request does not clearly justify a separate skill, STOP and report the overlap instead of creating a duplicate

### Shared Skill Workflow

#### Load Related Context

- Read the project conventions and the code, skills, scripts, docs, evals, or transcripts that affect this skill's behavior
- Treat observed project patterns, successful examples, and repeated corrections as stronger evidence than generic advice
- For optimization, map each requested improvement or observed failure to the current instruction that controls it

#### Design The Skill

- Define one reusable job and its completion criterion; split unrelated jobs instead of hiding them behind optional branches
- Derive `<skill-name>` by preferring `<requested-name>` when it is valid; otherwise create a lowercase hyphenated name that matches the intended folder name and satisfies the Agent Skills naming rules
- Store the target directory as `<skill-dir>` = `<skill-root>/<skill-name>`
- Determine the invocation modes and frontmatter fields supported by the project's skill runtime
- Choose `<invocation-mode>` as `model` when the agent or another skill must discover this skill autonomously; choose `user` only when a person will invoke it explicitly and the runtime supports user-only invocation
- For `model` invocation, write a description that starts with `Use when` and names each distinct trigger branch once
- For `user` invocation, use the runtime's supported user-only frontmatter and write a one-line human summary instead of a trigger list
- For procedural skills, put the ordered actions and their checkable completion criteria in `SKILL.md`; for reference-only skills, organize the guidance around the decisions it informs instead of inventing procedural steps
- Co-locate each concept's definition, rules, and exceptions; move branch-only or long reference material to a support file with an explicit condition telling the agent when to read it
- Keep one source of truth for each instruction and rely on repository files or command help for facts the agent can cheaply inspect
- Use direct positive instructions; keep prohibitions for safety or destructive actions
- Add examples, scripts, assets, and evals only when they change execution quality or make a completion check repeatable

#### Write The Skill

- Create or update `<skill-dir>/SKILL.md`
- Keep frontmatter to the fields required by `<invocation-mode>` and demonstrated project conventions
- For procedural skills, write concrete actions with observable end states; replace vague bounds such as "be thorough" or "use relevant context"
- Remove duplicate instructions, stale reference material, and statements that merely restate repository files
- Store the changed file list as `<file-lines>` with one bullet per file path

#### Validate The Skill

- Confirm the directory name matches the skill name in frontmatter
- Confirm the frontmatter is valid and matches `<invocation-mode>`
- Confirm every model-invoked trigger branch appears once in the description and every disclosed file has a load condition
- Confirm every procedural step has an observable completion criterion
- Confirm file references are relative to the skill root and resolve to real files
- If scripts or eval helpers were added or updated, run the most relevant available validation for those files
- Store the resulting validation summary as `<validation-results>`

### Output

If skill direction is missing, display:
```
Skill direction required

Provide the skill goal, workflow, or domain so the skill can be created.

No additional steps are required.
```

If an existing skill already covers the scope, display:
```
Skill already exists for this scope

Existing skill: <existing-skill-path>
Reason: <overlap-reason>

No additional steps are required.
```

When the skill is created, display:
```
Created skill: <skill-name>

Path: <skill-dir>/SKILL.md
Files:
<file-lines>

Validation:
<validation-results>

No additional steps are required.
```
