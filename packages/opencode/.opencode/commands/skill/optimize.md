---
description: Improve an existing Agent Skill from real feedback
agent: worker
---

## Goal

Improve an existing Agent Skill so it triggers more reliably, stays lean, and produces better outputs for the intended workflow.

## Additional Context

- Favor targeted iteration over full rewrites; keep what already works and change only the parts blocking activation or execution quality
- Prefer optimization grounded in real prompts, evals, reviewer feedback, transcripts, or repeated failures over speculative cleanup

## Workflow

### Arguments

<arguments>
$ARGUMENTS
</arguments>

### Interpret Arguments

- If `<arguments>` contains a skill path, folder, slug, or `SKILL.md` reference, store it as `<skill-ref>`
- If `<arguments>` includes an optimization focus such as triggering, output quality, evals, or excess complexity, store it as `<optimization-focus>`
- If `<arguments>` includes evidence such as prompts, failing cases, reviewer feedback, transcripts, or related files, store it as `<optimization-inputs>`
- If `<arguments>` includes constraints, audience, tools, or notes, store them as `<additional-context>`
- If `<skill-ref>` is still missing, derive it from the conversation
- If the target skill still cannot be determined, STOP and report that a skill reference is required

### Load Skill Context

- Resolve `<skill-ref>` to the target skill directory and store it as `<skill-dir>`
- Confirm `<skill-dir>/SKILL.md` exists; if not, STOP and report that the skill could not be found
- Read the current `SKILL.md`
- Read only the support files that materially affect the optimization focus, such as `references/`, `scripts/`, `assets/`, `evals/`, or nearby docs
- If optimization evidence was provided through `<optimization-inputs>`, load and use it as source context

### Reapply Skill Workflow

- Identify the smallest set of changes that will improve `<optimization-focus>` without rewriting working parts of the skill
- If the skill already matches the requested focus and no meaningful improvement is justified, STOP and report that no changes are needed

### Shared Skill Workflow

#### Load Related Context

- Read the project conventions and the code, skills, scripts, docs, evals, or transcripts that affect this skill's behavior
- Treat observed project patterns, successful examples, and repeated corrections as stronger evidence than generic advice
- For optimization, map each requested improvement or observed failure to the current instruction that controls it

#### Design The Skill

- Define one reusable job and its completion criterion; split unrelated jobs instead of hiding them behind optional branches
- Preserve the existing skill name and directory unless the user explicitly asked for a rename or move
- Store the working skill name as `<skill-name>` and keep `<skill-dir>` as the target directory
- Determine the invocation modes and frontmatter fields supported by the project's skill runtime
- Choose `<invocation-mode>` as `model` when the agent or another skill must discover this skill autonomously; choose `user` only when a person will invoke it explicitly and the runtime supports user-only invocation
- For `model` invocation, write a description that starts with `Use when` and names each distinct trigger branch once
- For `user` invocation, use the runtime's supported user-only frontmatter and write a one-line human summary instead of a trigger list
- Put the ordered actions and their checkable completion criteria in `SKILL.md`
- Co-locate each concept's definition, rules, and exceptions; move branch-only or long reference material to a support file with an explicit condition telling the agent when to read it
- Keep one source of truth for each instruction and rely on repository files or command help for facts the agent can cheaply inspect
- Use direct positive instructions; keep prohibitions for safety or destructive actions
- Add examples, scripts, assets, and evals only when they change execution quality or make a completion check repeatable

#### Write The Skill

- Create or update `<skill-dir>/SKILL.md`
- Keep frontmatter to the fields required by `<invocation-mode>` and demonstrated project conventions
- Write concrete actions with observable end states; replace vague bounds such as "be thorough" or "use relevant context"
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

If the target skill cannot be determined, display:
```
Skill reference required

Provide the skill path, folder, slug, or `SKILL.md` target to optimize.

No additional steps are required.
```

If the target skill cannot be found, display:
```
Skill not found

Target: <skill-ref>

No additional steps are required.
```

If no meaningful optimization is needed, display:
```
No skill changes needed

Skill: <skill-dir>
Reason: <no-change-reason>

No additional steps are required.
```

When the skill is optimized, display:
```
Optimized skill: <skill-dir>

Updated files:
<file-lines>

Validation:
<validation-results>

No additional steps are required.
```
