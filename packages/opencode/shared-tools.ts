import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

import {
  createChangesLoadTool,
  createPrLoadReviewTool,
  createPrLoadTool,
  createPrSyncTool,
  createTicketLoadTool,
  createTicketSyncTool,
  type MergedKompassConfig,
  type Shell,
  type ShellPromise,
} from "../core/index.ts";

export type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  worktree: string;
  abort: AbortSignal;
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void;
  ask(input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

export type ToolResult = string | {
  title?: string;
  output: string;
  metadata?: Record<string, unknown>;
};

export function tool<Args extends z.ZodRawShape>(input: {
  description: string;
  args: Args;
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>;
}) {
  return input;
}

tool.schema = z;

export type ToolDefinition = ReturnType<typeof tool>;

const execFileAsync = promisify(execFile);

type OpenCodeToolCreator = (
  config: MergedKompassConfig,
  shell: Shell,
) => ToolDefinition;

type ShellResult = ShellPromise & {
  stdout: Buffer;
};

function shellEscape(value: unknown): string {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function shellResult(stdout: string, stderr: string, exitCode: number): ShellResult {
  return {
    cwd: () => {
      throw new Error("Cannot change cwd after execution");
    },
    quiet: () => {
      throw new Error("Cannot change quiet after execution");
    },
    nothrow: () => {
      throw new Error("Cannot change nothrow after execution");
    },
    text: () => stdout,
    json: () => JSON.parse(stdout),
    exitCode,
    stderr: Buffer.from(stderr),
    stdout: Buffer.from(stdout),
  };
}

class NodeShellCommand implements PromiseLike<ShellResult> {
  #command: string;
  #cwd: string;
  #quiet = false;
  #nothrow = false;
  #result?: Promise<ShellResult>;

  constructor(command: string, cwd: string) {
    this.#command = command;
    this.#cwd = cwd;
  }

  cwd(dir: string) {
    this.#cwd = dir;
    return this;
  }

  quiet() {
    this.#quiet = true;
    return this;
  }

  nothrow() {
    this.#nothrow = true;
    return this;
  }

  then<TResult1 = ShellResult, TResult2 = never>(
    onfulfilled?: ((value: ShellResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(onfulfilled, onrejected);
  }

  private run() {
    this.#result ??= this.execute();
    return this.#result;
  }

  private async execute() {
    try {
      const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", this.#command], {
        cwd: this.#cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      this.write(stdout, stderr);
      return shellResult(stdout, stderr, 0);
    } catch (error) {
      const failed = error as { stdout?: unknown; stderr?: unknown; message?: unknown; code?: unknown };
      const stdout = String(failed.stdout ?? "");
      const stderr = String(failed.stderr ?? failed.message ?? "");
      const exitCode = typeof failed.code === "number" ? failed.code : 1;
      const result = shellResult(stdout, stderr, exitCode);

      this.write(stdout, stderr);
      if (this.#nothrow) return result;

      throw new Error(stderr || `Command failed: ${this.#command}`);
    }
  }

  private write(stdout: string, stderr: string) {
    if (this.#quiet) return;
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
}

export function createNodeShell(defaultDirectory: string): Shell {
  return (strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0] ?? "";

    expressions.forEach((expression, index) => {
      command += Array.isArray(expression)
        ? expression.map((item) => shellEscape(item)).join(" ")
        : shellEscape(expression);
      command += strings[index + 1] ?? "";
    });

    return new NodeShellCommand(command, defaultDirectory) as unknown as ShellPromise;
  };
}

const opencodeToolCreators: Record<string, OpenCodeToolCreator> = {
  changes_load(_: MergedKompassConfig, shell: Shell) {
    const definition = createChangesLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        base: tool.schema.string().describe("Base branch or ref").optional(),
        head: tool.schema.string().describe("Head branch, commit, or ref override").optional(),
        depthHint: tool.schema.number().int().positive()
          .describe("Optional shallow-fetch hint, such as PR commit count")
          .optional(),
        uncommitted: tool.schema.boolean()
          .describe("Only load uncommitted changes (staged and unstaged), never fall back to branch comparison")
          .optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  pr_load(_: MergedKompassConfig, shell: Shell) {
    const definition = createPrLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        pr: tool.schema.string().describe("PR number or URL").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  pr_load_review(_: MergedKompassConfig, shell: Shell) {
    const definition = createPrLoadReviewTool(shell);
    return tool({
      description: definition.description,
      args: {
        pr: tool.schema.string().describe("PR number or URL").optional(),
        since: tool.schema.string().describe("Exclusive ISO-8601 review checkpoint"),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  pr_sync(config: MergedKompassConfig, shell: Shell) {
    const definition = createPrSyncTool(shell);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("PR title; required when creating or renaming a PR").optional(),
        body: tool.schema.string().describe("PR body override").optional(),
        description: tool.schema.string().describe("Short PR description rendered above checklist sections").optional(),
        base: tool.schema.string().describe("Base branch to merge into").optional(),
        head: tool.schema.string().describe("Head branch to use when creating a PR").optional(),
        labels: tool.schema.array(tool.schema.string()).describe("Labels to add to the PR").optional(),
        removeLabels: tool.schema.array(tool.schema.string()).describe("Labels to remove from an existing PR").optional(),
        replaceLabels: tool.schema.array(tool.schema.string()).describe("Exact label set for the PR; an empty array clears all labels").optional(),
        assignees: tool.schema.array(tool.schema.string()).describe("Assignees to apply to the PR").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        draft: tool.schema.boolean().describe("Create as draft PR").optional(),
        refUrl: tool.schema.string().describe("Optional PR URL to update").optional(),
        commitId: tool.schema.string().describe("Commit SHA to anchor review comments to; omit unless sending review comments").optional(),
        review: tool.schema.object({
          body: tool.schema.string().describe("Optional review summary body").optional(),
          comments: tool.schema.array(tool.schema.object({
            path: tool.schema.string().describe("Changed file path"),
            body: tool.schema.string().describe("Inline review comment body"),
            line: tool.schema.number().int().describe("Ending line on the diff side"),
            startLine: tool.schema.number().int().describe("Starting line for multi-line comments").optional(),
            side: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the ending line").optional(),
            startSide: tool.schema.enum(["LEFT", "RIGHT"]).describe("Diff side for the starting line").optional(),
          })).describe("Inline review comments to submit").optional(),
          ...(config.shared.prApprove
            ? { approve: tool.schema.boolean().describe("Approve the PR with this review comment").optional() }
            : {}
          ),
        }).describe("Optional structured review submission; omit the field entirely unless submitting a review body, inline comments, or approval").optional(),
        replies: tool.schema.array(tool.schema.object({
          inReplyTo: tool.schema.number().int().describe("Existing review comment ID to reply to"),
          body: tool.schema.string().describe("Reply body"),
        })).describe("Replies to existing review comments").optional(),
        commentBody: tool.schema.string().describe("General PR comment body").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_sync(_: MergedKompassConfig, shell: Shell) {
    const definition = createTicketSyncTool(shell);
    return tool({
      description: definition.description,
      args: {
        title: tool.schema.string().describe("Issue title").optional(),
        body: tool.schema.string().describe("Issue body override").optional(),
        description: tool.schema.string().describe("Issue description rendered above checklist sections").optional(),
        labels: tool.schema.array(tool.schema.string()).describe("Labels to apply to the issue").optional(),
        assignees: tool.schema.array(tool.schema.string()).describe("Assignees to apply to the issue").optional(),
        checklists: tool.schema.array(tool.schema.object({
          name: tool.schema.string().describe("Checklist section name"),
          items: tool.schema.array(tool.schema.object({
            name: tool.schema.string().describe("Checklist item name"),
            completed: tool.schema.boolean().describe("Whether the item is completed"),
          })).describe("Checklist items"),
        })).describe("Checklist sections rendered as markdown").optional(),
        refUrl: tool.schema.string().describe("Optional issue URL to update").optional(),
        comments: tool.schema.array(tool.schema.string()).describe("Optional issue comments to post").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
  ticket_load(_: MergedKompassConfig, shell: Shell) {
    const definition = createTicketLoadTool(shell);
    return tool({
      description: definition.description,
      args: {
        source: tool.schema.string().describe("Issue URL, repo#id, #id, file path, or raw text"),
        comments: tool.schema.boolean().describe("Include issue comments").optional(),
      },
      execute: (args, context) => definition.execute(args, context),
    });
  },
};

export function createCoreOpenCodeToolDefinitions(
  config: MergedKompassConfig,
  projectRoot: string,
): Record<string, ToolDefinition> {
  const shell = createNodeShell(projectRoot);
  return Object.fromEntries(
    Object.entries(opencodeToolCreators).map(([name, create]) => [name, create(config, shell)]),
  );
}
