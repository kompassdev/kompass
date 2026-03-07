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

export async function ensureGitRef(
  $: Shell,
  cwd: string,
  ref: string,
  options?: { depthHint?: number },
) {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error("Git ref cannot be empty");
  }

  const directCandidates = [trimmed];
  if (!trimmed.startsWith("origin/")) {
    directCandidates.push(`origin/${trimmed}`);
  }

  for (const candidate of directCandidates) {
    if (await gitRefExists($, cwd, candidate)) {
      return candidate;
    }
  }

  const remoteBranch = trimmed.startsWith("origin/") ? trimmed.slice("origin/".length) : trimmed;
  const fetchProc = options?.depthHint
    ? await $`git fetch --no-tags --depth=${Math.max(options.depthHint, 20)} origin ${remoteBranch}:${`refs/remotes/origin/${remoteBranch}`}`
        .cwd(cwd)
        .quiet()
        .nothrow()
    : await $`git fetch --no-tags origin ${remoteBranch}:${`refs/remotes/origin/${remoteBranch}`}`
        .cwd(cwd)
        .quiet()
        .nothrow();

  if (fetchProc.exitCode === 0 && (await gitRefExists($, cwd, `origin/${remoteBranch}`))) {
    return `origin/${remoteBranch}`;
  }

  if (await gitRefExists($, cwd, trimmed)) {
    return trimmed;
  }

  throw new Error(fetchProc.stderr.toString() || `Failed to resolve git ref ${ref}`);
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
