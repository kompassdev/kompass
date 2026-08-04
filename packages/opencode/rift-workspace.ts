import path from "node:path";

type WorkspaceInfo = {
  id: string;
  type: string;
  name: string;
  branch: string | null;
  directory: string | null;
  extra: unknown | null;
  projectID: string;
};

type WorkspaceTarget = { type: "local"; directory: string };

type WorkspaceAdapter = {
  name: string;
  description: string;
  configure(config: WorkspaceInfo): WorkspaceInfo | Promise<WorkspaceInfo>;
  create(config: WorkspaceInfo, env: Record<string, string | undefined>, from?: WorkspaceInfo): Promise<void>;
  list?(): WorkspaceInfo[] | Promise<WorkspaceInfo[]>;
  remove(config: WorkspaceInfo): Promise<void>;
  target(config: WorkspaceInfo): WorkspaceTarget | Promise<WorkspaceTarget>;
};

type RiftModule = {
  init(options?: { at?: string }): null;
  create(options?: { from?: string; name?: string; copyAll?: boolean; hooks?: boolean }): string;
  remove(options?: { at?: string; all?: false }): void;
  list(options?: { of?: string }): string[];
};

type RiftAdapterOptions = {
  sourceDirectory: string;
  projectID: string;
};

type ExperimentalWorkspaceInput = {
  experimental_workspace?: { register(type: string, adapter: WorkspaceAdapter): void };
  project?: { id?: string; worktree?: string };
  worktree?: string;
  directory?: string;
};

type Logger = {
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
};

const importModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "") || "rift";
}

function workspaceName(config: WorkspaceInfo) {
  const extra = typeof config.extra === "object" && config.extra ? config.extra as { name?: unknown } : {};
  return slugify(typeof extra.name === "string" ? extra.name : config.name || config.id);
}

function managedRoot(sourceDirectory: string) {
  return path.join(path.dirname(sourceDirectory), ".rifts", path.basename(sourceDirectory));
}

function requireManagedDirectory(sourceDirectory: string, directory: unknown, operation: string) {
  if (typeof directory !== "string" || !directory) {
    throw new Error(`Rift workspace ${operation} is missing a directory`);
  }
  const resolved = path.resolve(directory);
  const root = path.resolve(managedRoot(sourceDirectory));
  if (path.dirname(resolved) !== root) {
    throw new Error(`Rift workspace ${operation} directory ${resolved} is outside managed root ${root}`);
  }
  return resolved;
}

function requireProject(config: WorkspaceInfo, projectID: string) {
  if (config.projectID !== projectID) {
    throw new Error(`Rift workspace belongs to project ${config.projectID}; expected ${projectID}`);
  }
}

function workspaceDirectory(sourceDirectory: string, name: string) {
  return path.join(managedRoot(sourceDirectory), name);
}

function availableWorkspaceName(rift: RiftModule, sourceDirectory: string, requested: string) {
  const existing = new Set(rift.list({ of: sourceDirectory }).map((directory) =>
    path.basename(requireManagedDirectory(sourceDirectory, directory, "listed")),
  ));
  if (!existing.has(requested)) return requested;
  let suffix = 2;
  while (existing.has(`${requested}-${suffix}`)) suffix += 1;
  return `${requested}-${suffix}`;
}

export function resolveRiftSourceDirectory(directory: string) {
  const resolved = path.resolve(directory);
  const marker = `${path.sep}.rifts${path.sep}`;
  const markerIndex = resolved.indexOf(marker);
  if (markerIndex < 0) return resolved;
  const namespace = resolved.slice(markerIndex + marker.length).split(path.sep)[0];
  return namespace ? path.join(resolved.slice(0, markerIndex), namespace) : resolved;
}

export function createRiftWorkspaceAdapter(rift: RiftModule, options: RiftAdapterOptions): WorkspaceAdapter {
  const sourceDirectory = path.resolve(options.sourceDirectory);

  return {
    name: "Rift",
    description: "Create a copy-on-write Rift workspace",
    configure(config) {
      requireProject(config, options.projectID);
      const name = availableWorkspaceName(rift, sourceDirectory, workspaceName(config));
      const directory = requireManagedDirectory(
        sourceDirectory,
        workspaceDirectory(sourceDirectory, name),
        "configured",
      );
      return {
        ...config,
        type: "rift",
        name,
        branch: null,
        directory,
        extra: { ...(typeof config.extra === "object" && config.extra ? config.extra : {}), sourceDirectory },
      };
    },
    async create(config, _env, from) {
      requireProject(config, options.projectID);
      const source = path.resolve(from?.directory ?? sourceDirectory);
      if (from) {
        requireProject(from, options.projectID);
        requireManagedDirectory(sourceDirectory, source, "creation source");
      }
      const expected = requireManagedDirectory(sourceDirectory, config.directory, "creation target");
      rift.init({ at: source });
      const created = path.resolve(rift.create({
        from: source,
        name: config.name,
        // Use Rift's APFS full-clone path; the filtered walker can fail on protected macOS xattrs.
        copyAll: true,
      }));
      if (created !== expected) {
        try {
          rift.remove({ at: created });
        } catch (error) {
          throw new Error(
            `Rift created ${created}, but OpenCode registered ${expected}. Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        throw new Error(`Rift created ${created}, but OpenCode registered ${expected}. The created Rift was removed`);
      }
    },
    list() {
      const directories = new Set(rift.list({ of: sourceDirectory }).map((directory) =>
        requireManagedDirectory(sourceDirectory, directory, "listed"),
      ));
      return [...directories].map((directory) => ({
        id: `rift-${path.basename(directory)}`,
        type: "rift",
        name: path.basename(directory),
        branch: null,
        directory,
        extra: { sourceDirectory },
        projectID: options.projectID,
      }));
    },
    async remove(config) {
      requireProject(config, options.projectID);
      rift.remove({ at: requireManagedDirectory(sourceDirectory, config.directory, "removal target") });
    },
    target(config) {
      requireProject(config, options.projectID);
      return {
        type: "local",
        directory: requireManagedDirectory(sourceDirectory, config.directory, "target"),
      };
    },
  };
}

export async function registerRiftWorkspaceAdapter(input: ExperimentalWorkspaceInput, logger: Logger) {
  const registrar = input.experimental_workspace;
  const projectID = input.project?.id;
  // Plugin directory/worktree values may identify a managed workspace. The project's
  // worktree is OpenCode's canonical checkout and remains stable across workspaces.
  const sourceCandidate = input.project?.worktree ?? input.directory ?? input.worktree;
  if (!registrar || !projectID || !sourceCandidate) return;
  const sourceDirectory = resolveRiftSourceDirectory(sourceCandidate);

  let rift: RiftModule;
  try {
    rift = await importModule("rift-snapshot") as RiftModule;
  } catch (error) {
    logger.info("Rift workspace adapter not registered", {
      reason: "Install rift-snapshot to enable the experimental Rift workspace adapter",
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    registrar.register("rift", createRiftWorkspaceAdapter(rift, { sourceDirectory, projectID }));
    logger.info("Registered Rift workspace adapter", { type: "rift" });
  } catch (error) {
    logger.warn("Rift workspace adapter registration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
