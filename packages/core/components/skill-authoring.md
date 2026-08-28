### Shared Skill Workflow

#### Load Related Context

- Read the project conventions and the code, skills, scripts, docs, evals, or transcripts that affect this skill's behavior
- Treat observed project patterns, successful examples, and repeated corrections as stronger evidence than generic advice
- For optimization, map each requested improvement or observed failure to the current instruction that controls it

#### Design The Skill

- Define one reusable job and its completion criterion; split unrelated jobs instead of hiding them behind optional branches
<% if (it.mode === "create") { -%>
- Derive `<skill-name>` by preferring `<requested-name>` when it is valid; otherwise create a lowercase hyphenated name that matches the intended folder name and satisfies the Agent Skills naming rules
- Store the target directory as `<skill-dir>` = `<skill-root>/<skill-name>`
<% } else { -%>
- Preserve the existing skill name and directory unless the user explicitly asked for a rename or move
- Store the working skill name as `<skill-name>` and keep `<skill-dir>` as the target directory
<% } -%>
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
