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

export type ToolExecutionContext = {
  worktree: string;
  directory: string;
};

export type ToolArgDefinition =
  | {
      type: "string";
      description: string;
      optional?: boolean;
    }
  | {
      type: "boolean";
      description: string;
      optional?: boolean;
    }
  | {
      type: "number";
      description: string;
      optional?: boolean;
      int?: boolean;
      positive?: boolean;
    }
  | {
      type: "string[]";
      description: string;
      optional?: boolean;
    }
  | {
      type: "json";
      description: string;
      optional?: boolean;
    };

export interface ToolDefinition<Args = Record<string, unknown>> {
  description: string;
  args: Record<string, ToolArgDefinition>;
  execute(args: Args, ctx: ToolExecutionContext): Promise<string>;
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

export function nonEmptyLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export type ChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "type_changed"
  | "unmerged"
  | "unknown";

export type ChangedFile = {
  rawStatus: string;
  status: ChangeStatus;
  path: string;
  previousPath?: string;
  similarity?: number;
};

function normalizeStatus(code: string): ChangeStatus {
  if (code === "??") {
    return "untracked";
  }

  switch (code[0]) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    case "U":
      return "unmerged";
    default:
      return "unknown";
  }
}

export function parseNameStatus(text: string) {
  return nonEmptyLines(text).map((line): ChangedFile => {
    const [rawStatus, ...parts] = line.split("\t");
    const status = normalizeStatus(rawStatus);
    const similarity = Number.parseInt(rawStatus.slice(1), 10);

    if ((status === "renamed" || status === "copied") && parts.length >= 2) {
      return {
        rawStatus,
        status,
        previousPath: parts[0],
        path: parts[1],
        similarity: Number.isNaN(similarity) ? undefined : similarity,
      };
    }

    return {
      rawStatus,
      status,
      path: parts[0] || "",
      similarity: Number.isNaN(similarity) ? undefined : similarity,
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

  for (const candidate of ["origin/main", "origin/master", "origin/dev", "main", "master", "dev"]) {
    const proc = await $`git rev-parse --verify ${candidate}`.cwd(cwd).quiet().nothrow();
    if (proc.exitCode === 0) {
      return candidate;
    }
  }

  return "HEAD~1";
}

export async function gitRefExists($: Shell, cwd: string, ref: string) {
  const proc = await $`git rev-parse --verify ${ref}`.cwd(cwd).quiet().nothrow();
  return proc.exitCode === 0;
}

export async function resolveComparisonRef(
  $: Shell,
  cwd: string,
  ref: string,
  options?: { depthHint?: number },
) {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error("Git ref cannot be empty");
  }

  if (trimmed === "HEAD") {
    return trimmed;
  }

  if (trimmed.startsWith("refs/")) {
    if (await gitRefExists($, cwd, trimmed)) {
      return trimmed;
    }

    throw new Error(`Failed to resolve git ref ${ref}`);
  }

  if (/^[0-9a-f]{7,40}$/i.test(trimmed)) {
    if (await gitRefExists($, cwd, trimmed)) {
      return trimmed;
    }

    const fetchProc = await fetchCommit($, cwd, trimmed, options?.depthHint);
    if (fetchProc.exitCode === 0 && (await gitRefExists($, cwd, trimmed))) {
      return trimmed;
    }

    throw new Error(fetchProc.stderr.toString() || `Failed to resolve git ref ${ref}`);
  }

  const remoteBranch = trimmed.startsWith("origin/") ? trimmed.slice("origin/".length) : trimmed;
  const remoteCandidate = `origin/${remoteBranch}`;
  let fetchError = "";

  if (await hasRemote($, cwd, "origin")) {
    const fetchProc = await fetchRemoteBranch($, cwd, remoteBranch, options?.depthHint);
    fetchError = fetchProc.stderr.toString();
    if (fetchProc.exitCode === 0 && (await gitRefExists($, cwd, remoteCandidate))) {
      return remoteCandidate;
    }
  }

  if (await gitRefExists($, cwd, trimmed)) {
    return trimmed;
  }

  if (!trimmed.startsWith("origin/") && (await gitRefExists($, cwd, remoteCandidate))) {
    return remoteCandidate;
  }

  throw new Error(fetchError || `Failed to resolve git ref ${ref}`);
}

async function hasRemote($: Shell, cwd: string, remote: string) {
  const proc = await $`git remote get-url ${remote}`.cwd(cwd).quiet().nothrow();
  return proc.exitCode === 0;
}

async function fetchRemoteBranch($: Shell, cwd: string, remoteBranch: string, depthHint?: number) {
  const remoteRefspec = `+${remoteBranch}:refs/remotes/origin/${remoteBranch}`;
  return depthHint
    ? await $`git fetch --no-tags --depth=${Math.max(depthHint, 20)} origin ${remoteRefspec}`
        .cwd(cwd)
        .quiet()
        .nothrow()
    : await $`git fetch --no-tags origin ${remoteRefspec}`
        .cwd(cwd)
        .quiet()
        .nothrow();
}

async function fetchCommit($: Shell, cwd: string, commit: string, depthHint?: number) {
  return depthHint
    ? await $`git fetch --no-tags --depth=${Math.max(depthHint, 20)} origin ${commit}`
        .cwd(cwd)
        .quiet()
        .nothrow()
    : await $`git fetch --no-tags origin ${commit}`
        .cwd(cwd)
        .quiet()
        .nothrow();
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
