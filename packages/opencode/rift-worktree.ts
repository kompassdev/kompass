import { Worktree } from "@opencode/plugin/effect";
import type { WorktreeDefinition } from "@opencode/plugin/effect/worktree";
import { Effect, Predicate } from "effect";
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createRiftSnapshot, loadRift, type RiftBackend } from "./rift.ts";

const execFileAsync = promisify(execFile);
const resolveDirectory = (directory: string) => Effect.tryPromise({ try: () => realpath(directory), catch: (error) => error });

export function createRiftWorktreeStrategy(
  backend: Effect.Effect<RiftBackend, unknown> = Effect.tryPromise({ try: loadRift, catch: (error) => error }),
): WorktreeDefinition {
  return {
    id: "rift",
    create: Effect.fn("rift.create")(function* (input) {
      if (input.branch !== undefined) {
        return yield* Effect.fail(new Worktree.OperationError({
          message: "Rift snapshots the source checkout and cannot select a starting branch or ref. Use the git strategy for a starting ref.",
        }));
      }
      const rift = yield* backend;
      const name = path.basename(input.directory);
      // Rift's FFI operation is synchronous; capture its failures in the Effect
      // error channel and return the created directory before yielding again.
      return yield* Effect.try({ try: () => {
        for (let attempt = 1; ; attempt++) {
          try {
            const directory = createRiftSnapshot(rift, {
              from: input.sourceDirectory,
              name: attempt === 1 ? name : `${name}-${attempt}`,
            });
            return { directory: path.resolve(directory) };
          } catch (error) {
            // OpenCode checks its suggested destination; Rift owns a different
            // storage directory, so resolve collisions reported by Rift there.
            if (!(error instanceof Error) || !Predicate.hasProperty(error, "code")) throw error;
            const targetsSource = error.code === "inside_source" && Predicate.hasProperty(error, "path")
              && Predicate.isString(error.path) && path.resolve(error.path) === path.resolve(input.sourceDirectory);
            if ((error.code !== "already_exists" && !targetsSource) || attempt >= 100) throw error;
          }
        }
      }, catch: (error) => error });
    }),
    list: Effect.fn("rift.list")(function* (sourceDirectory) {
      const rift = yield* backend;
      const ancestors = yield* Effect.try({ try: () => rift.ancestors({ of: sourceDirectory }), catch: (error) => error }).pipe(
        Effect.catch((error) => error instanceof Error && Predicate.hasProperty(error, "code") && error.code === "workspace_not_initialized"
          ? Effect.succeed(undefined) : Effect.fail(error)),
      );
      if (!ancestors) return [];
      const root = yield* resolveDirectory(ancestors.at(-1) ?? sourceDirectory);
      const entries: Array<{ directory: string; type: "root" | "worktree" }> = [{ directory: root, type: "root" }];
      const seen = new Set([root]);
      // Rift lists immediate children; OpenCode needs siblings and descendants.
      for (const entry of entries) {
        const children = yield* Effect.try({ try: () => rift.list({ of: entry.directory }), catch: (error) => error });
        for (const child of children) {
          const directory = yield* resolveDirectory(child).pipe(Effect.catch((error) => Predicate.hasProperty(error, "code") && error.code === "ENOENT"
            ? Effect.succeed(undefined) : Effect.fail(error)));
          if (!directory || seen.has(directory)) continue;
          seen.add(directory);
          entries.push({ directory, type: "worktree" });
        }
      }
      return entries;
    }),
    remove: Effect.fn("rift.remove")(function* (input) {
      const rift = yield* backend;
      const directory = yield* resolveDirectory(input.directory);
      yield* Effect.try({ try: () => {
        const parent = rift.ancestors({ of: directory })[0];
        if (!parent || !rift.list({ of: parent }).some((child) => path.resolve(child) === directory)) {
          throw new Worktree.OperationError({ message: `Not a Rift snapshot root: ${directory}` });
        }
      }, catch: (error) => error });
      if (!input.force) {
        const { stdout } = yield* Effect.tryPromise({
          try: (signal) => execFileAsync("git", ["-C", directory, "status", "--porcelain", "--untracked-files=all"], { signal }),
          catch: (error) => error,
        });
        if (stdout.trim()) {
          return yield* Effect.fail(new Worktree.OperationError({ message: "Rift snapshot has uncommitted changes.", forceRequired: true }));
        }
      }
      // Check children and remove in one synchronous operation, after Git's
      // async status call, to avoid cascading into newly created snapshots.
      yield* Effect.try({ try: () => {
        if (rift.list({ of: directory }).length) {
          throw new Worktree.OperationError({ message: "Remove this Rift snapshot's child snapshots first." });
        }
        rift.remove({ at: directory });
      }, catch: (error) => error });
    }),
  };
}
