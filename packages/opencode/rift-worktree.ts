import { Worktree } from "@opencode/plugin";
import type { WorktreeDefinition } from "@opencode/plugin/promise/worktree";
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createRiftSnapshot, loadRift, type RiftBackend } from "./rift.ts";

const execFileAsync = promisify(execFile);

function isUninitialized(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "workspace_not_initialized";
}

export function createRiftWorktreeStrategy(load: () => Promise<RiftBackend> = loadRift): WorktreeDefinition {
  async function backend(signal: AbortSignal) {
    signal.throwIfAborted();
    const rift = await load();
    signal.throwIfAborted();
    return rift;
  }

  return {
    id: "rift",
    async create(input, { signal }) {
      if (input.branch !== undefined) {
        throw new Worktree.OperationError({
          message: "Rift snapshots the source checkout and cannot select a starting branch or ref. Use the git strategy for a starting ref.",
        });
      }
      const rift = await backend(signal);
      // Rift's native calls are synchronous. Check cancellation before entering them;
      // once creation completes, return its path so OpenCode can record ownership.
      const name = path.basename(input.directory);
      for (let attempt = 1; ; attempt++) {
        signal.throwIfAborted();
        try {
          const directory = createRiftSnapshot(rift, {
            from: input.sourceDirectory,
            name: attempt === 1 ? name : `${name}-${attempt}`,
          });
          return { directory: path.resolve(directory) };
        } catch (error) {
          // OpenCode checks its suggested destination, but Rift owns a different
          // storage directory. Resolve collisions reported by Rift there.
          if (!(error instanceof Error) || !("code" in error)) throw error;
          const targetsSource = error.code === "inside_source" && "path" in error
            && typeof error.path === "string" && path.resolve(error.path) === path.resolve(input.sourceDirectory);
          if ((error.code !== "already_exists" && !targetsSource) || attempt >= 100) throw error;
        }
      }
    },
    async list(sourceDirectory, { signal }) {
      const rift = await backend(signal);
      let ancestors: string[];
      try {
        ancestors = rift.ancestors({ of: sourceDirectory });
      } catch (error) {
        if (isUninitialized(error)) return [];
        throw error;
      }
      const root = await realpath(ancestors.at(-1) ?? sourceDirectory);
      const entries: Array<{ directory: string; type: "root" | "worktree" }> = [{ directory: root, type: "root" }];
      const seen = new Set([root]);
      // Rift lists immediate children; OpenCode needs the whole project inventory,
      // including siblings and snapshots created from another snapshot.
      for (const entry of entries) {
        signal.throwIfAborted();
        for (const child of rift.list({ of: entry.directory })) {
          const directory = await realpath(child).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return undefined;
            throw error;
          });
          if (!directory) continue;
          if (seen.has(directory)) continue;
          seen.add(directory);
          entries.push({ directory, type: "worktree" });
        }
      }
      return entries;
    },
    async remove(input, { signal }) {
      const rift = await backend(signal);
      const directory = await realpath(input.directory);
      signal.throwIfAborted();
      const parent = rift.ancestors({ of: directory })[0];
      if (!parent || !rift.list({ of: parent }).some((child) => path.resolve(child) === directory)) {
        throw new Worktree.OperationError({ message: `Not a Rift snapshot root: ${directory}` });
      }
      if (!input.force) {
        const { stdout } = await execFileAsync("git", ["-C", directory, "status", "--porcelain", "--untracked-files=all"], { signal });
        if (stdout.trim()) {
          throw new Worktree.OperationError({ message: "Rift snapshot has uncommitted changes.", forceRequired: true });
        }
      }
      signal.throwIfAborted();
      // Rift removes an entire subtree. Check after the async status call so a
      // snapshot created while Git was running cannot be removed with its parent.
      if (rift.list({ of: directory }).length) {
        throw new Worktree.OperationError({ message: "Remove this Rift snapshot's child snapshots first." });
      }
      rift.remove({ at: directory });
    },
  };
}
