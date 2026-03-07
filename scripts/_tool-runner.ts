#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolContext } from "@opencode-ai/plugin/tool";

import type { Shell, ShellPromise } from "../tools/shared.ts";

const execFileAsync = promisify(execFile);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDirectory, "..");

type CommandResult = ShellPromise & {
  stdout: Buffer;
};

function shellEscape(value: unknown): string {
  const text = String(value);
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

class Command implements PromiseLike<CommandResult> {
  #cwd = repoRoot;
  #quiet = false;
  #nothrow = false;
  #result?: Promise<CommandResult>;

  constructor(private command: string) {}

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

  then<TResult1 = CommandResult, TResult2 = never>(
    onfulfilled?: ((value: CommandResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(onfulfilled, onrejected);
  }

  private run() {
    if (!this.#result) {
      this.#result = this.execute();
    }

    return this.#result;
  }

  private async execute(): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", this.command], {
        cwd: this.#cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!this.#quiet && stdout) {
        process.stdout.write(stdout);
      }
      if (!this.#quiet && stderr) {
        process.stderr.write(stderr);
      }

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
        exitCode: 0,
        stderr: Buffer.from(stderr),
        stdout: Buffer.from(stdout),
      };
    } catch (error: any) {
      const stdout = String(error.stdout ?? "");
      const stderr = String(error.stderr ?? error.message ?? "");
      const exitCode = typeof error.code === "number" ? error.code : 1;

      if (!this.#quiet && stdout) {
        process.stdout.write(stdout);
      }
      if (!this.#quiet && stderr) {
        process.stderr.write(stderr);
      }

      const result: CommandResult = {
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

      if (this.#nothrow) {
        return result;
      }

      throw new Error(stderr || `Command failed: ${this.command}`);
    }
  }
}

export function createShell(): Shell {
  return createShellForDirectory(repoRoot);
}

export function createShellForDirectory(defaultDirectory: string): Shell {
  return (strings: TemplateStringsArray, ...expressions: unknown[]) => {
    let command = strings[0] ?? "";

    expressions.forEach((expression, index) => {
      command += shellEscape(expression) + (strings[index + 1] ?? "");
    });

    const runner = new Command(command);
    runner.cwd(defaultDirectory);
    return runner as unknown as ShellPromise;
  };
}

export function createToolContext(): ToolContext {
  return createToolContextForDirectory(repoRoot);
}

export function createToolContextForDirectory(worktree: string): ToolContext {
  return {
    sessionID: "script-session",
    messageID: "script-message",
    agent: "script",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  };
}
