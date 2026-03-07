import path from "node:path";

export interface ShellPromise {
  cwd(dir: string): ShellPromise;
  quiet(): ShellPromise;
  nothrow(): ShellPromise;
  text(): string;
  json(): unknown;
  exitCode: number;
  stderr: Buffer;
}

export interface Shell {
  (strings: TemplateStringsArray, ...expressions: unknown[]): ShellPromise;
}

export type PluginContext = {
  worktree: string;
  directory: string;
};

export function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function nonEmptyLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export function parseNameStatus(text: string) {
  return nonEmptyLines(text).map((line) => {
    const [status, ...rest] = line.split("\t");
    return {
      status,
      path: rest.join("\t"),
    };
  });
}

export function parseCommitList(text: string) {
  return nonEmptyLines(text).map((line) => {
    const [sha, subject] = line.split("\t");
    return { sha, subject };
  });
}

export async function loadRepoName($: Shell, cwd: string) {
  const proc = await $`gh repo view --json nameWithOwner`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || "Failed to load repository");
  }

  return JSON.parse(proc.text()).nameWithOwner;
}

export async function resolveBaseRef($: Shell, cwd: string, input?: string) {
  if (input?.trim()) {
    return input.trim();
  }

  const head = await $`git symbolic-ref refs/remotes/origin/HEAD`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (head.exitCode === 0) {
    return head.text().trim().replace(/^refs\/remotes\//, "");
  }

  const remote = await $`git rev-parse --verify origin/dev`
    .cwd(cwd)
    .quiet()
    .nothrow();

  if (remote.exitCode === 0) {
    return "origin/dev";
  }

  const local = await $`git rev-parse --verify dev`.cwd(cwd).quiet().nothrow();
  if (local.exitCode === 0) {
    return "dev";
  }

  return "HEAD~1";
}

export function parseIssueReference(source: string) {
  const url = source.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:[/?#].*)?$/,
  );
  if (url) {
    return { repo: url[1], number: url[2] };
  }

  const ref = source.match(/^([^/\s]+\/[^#\s]+)#(\d+)$/);
  if (ref) {
    return { repo: ref[1], number: ref[2] };
  }

  const local = source.match(/^#(\d+)$/);
  if (local) {
    return { number: local[1] };
  }

  return null;
}

export function resolveInputPath(baseDirectory: string, input: string) {
  return path.isAbsolute(input) ? input : path.resolve(baseDirectory, input);
}
