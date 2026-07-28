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
  project?: { id?: string; path?: string };
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

function workspaceDirectory(sourceDirectory: string, name: string) {
  return path.join(managedRoot(sourceDirectory), name);
}

function requireDirectory(config: WorkspaceInfo) {
  if (!config.directory) throw new Error("Rift workspace is missing a directory");
  return config.directory;
}

export function createRiftWorkspaceAdapter(rift: RiftModule, options: RiftAdapterOptions): WorkspaceAdapter {
  const sourceDirectory = path.resolve(options.sourceDirectory);

  return {
    name: "Rift",
    description: "Create a copy-on-write Rift workspace",
    configure(config) {
      const name = workspaceName(config);
      return {
        ...config,
        type: "rift",
        name,
        branch: null,
        directory: workspaceDirectory(sourceDirectory, name),
        extra: { ...(typeof config.extra === "object" && config.extra ? config.extra : {}), sourceDirectory },
      };
    },
    async create(config, _env, from) {
      const source = path.resolve(from?.directory ?? sourceDirectory);
      const expected = path.resolve(requireDirectory(config));
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
      return rift.list({ of: sourceDirectory }).map((directory) => ({
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
      rift.remove({ at: requireDirectory(config) });
    },
    target(config) {
      return { type: "local", directory: requireDirectory(config) };
    },
  };
}

export async function registerRiftWorkspaceAdapter(input: ExperimentalWorkspaceInput, logger: Logger) {
  const registrar = input.experimental_workspace;
  const projectID = input.project?.id;
  // A plugin loaded inside a managed workspace still belongs to the stable project checkout.
  // Using input.worktree here would recursively nest new Rifts below the current Rift.
  const sourceDirectory = input.project?.path ?? input.directory ?? input.worktree;
  if (!registrar || !projectID || !sourceDirectory) return;

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
