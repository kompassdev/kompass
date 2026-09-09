import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Worktree } from "@opencode/plugin/effect";
import { Deferred, Effect, Fiber } from "effect";
import { createRiftWorktreeStrategy } from "../rift-worktree.ts";
import type { RiftBackend } from "../rift.ts";

const execFileAsync = promisify(execFile);

function backend(overrides: Partial<RiftBackend> = {}): RiftBackend {
  return {
    init: () => null,
    create: () => { throw new Error("Unexpected create"); },
    remove: () => { throw new Error("Unexpected remove"); },
    list: () => [],
    ancestors: () => [],
    ...overrides,
  };
}

describe("Rift V2 worktree strategy", () => {
  test("uses OpenCode's source and name while letting Rift choose the destination", async () => {
    const calls: unknown[] = [];
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      init(options) { calls.push(options); return null; },
      create(options) { calls.push(options); return "/snapshots/actual"; },
    })));
    assert.deepEqual(await Effect.runPromise(strategy.create({ sourceDirectory: "/source", directory: "/custom/task" })), {
      directory: "/snapshots/actual",
    });
    assert.deepEqual(calls, [
      { at: "/source" },
      { from: "/source", name: "task", copyAll: true },
    ]);
  });

  test("suffixes name collisions in Rift's own storage", async () => {
    const names: Array<string | undefined> = [];
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      create(options) {
        names.push(options?.name);
        if (names.length === 1) throw Object.assign(new Error("Snapshot exists"), { code: "already_exists" });
        return `/projects/.rifts/source/${options?.name}`;
      },
    })));
    assert.deepEqual(await Effect.runPromise(strategy.create({ sourceDirectory: "/source", directory: "/suggested/task" })), {
      directory: "/projects/.rifts/source/task-2",
    });
    assert.deepEqual(names, ["task", "task-2"]);
  });

  test("suffixes a snapshot name that would target the source snapshot itself", async () => {
    const sourceDirectory = "/projects/.rifts/source/task";
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      create(options) {
        if (options?.name === "task") {
          throw Object.assign(new Error("Cannot copy into itself"), { code: "inside_source", path: sourceDirectory });
        }
        return `/projects/.rifts/source/${options?.name}`;
      },
    })));
    assert.deepEqual(await Effect.runPromise(strategy.create({ sourceDirectory, directory: "/suggested/task" })), {
      directory: "/projects/.rifts/source/task-2",
    });
  });

  test("rejects starting refs before loading Rift", async () => {
    const strategy = createRiftWorktreeStrategy(Effect.die("Must not load"));
    await assert.rejects(Effect.runPromise(strategy.create({ sourceDirectory: "/source", directory: "/task", branch: "main" })),
      (error) => error instanceof Worktree.OperationError && /starting branch or ref/.test(error.message));
  });

  test("interruption releases backend acquisition without performing native operations", async () => {
    for (const operation of ["create", "list", "remove"] as const) {
      const started = Deferred.makeUnsafe<void>();
      let released = false;
      const strategy = createRiftWorktreeStrategy(Effect.gen(function* () {
        yield* Deferred.succeed(started, undefined);
        return yield* Effect.never;
      }).pipe(Effect.ensuring(Effect.sync(() => { released = true; }))));
      const effect = operation === "create" ? strategy.create({ sourceDirectory: "/source", directory: "/task" })
        : operation === "list" ? strategy.list("/source") : strategy.remove({ directory: "/task", force: true });
      await Effect.runPromise(Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(effect);
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
      }));
      assert.equal(released, true);
    }
  });

  test("propagates creation errors without retrying", async () => {
    let attempts = 0;
    const failure = new Error("copy-on-write unavailable");
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({ create() { attempts++; throw failure; } })));
    await assert.rejects(Effect.runPromise(strategy.create({ sourceDirectory: "/source", directory: "/task" })), (error) => error === failure);
    assert.equal(attempts, 1);
  });

  test("uninitialized roots have no inventory; registry errors are surfaced", async () => {
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      ancestors() { throw Object.assign(new Error("Not initialized"), { code: "workspace_not_initialized" }); },
    })));
    assert.deepEqual(await Effect.runPromise(strategy.list("/source")), []);
    const failure = new Error("registry damaged");
    const broken = createRiftWorktreeStrategy(Effect.succeed(backend({ ancestors() { throw failure; } })));
    await assert.rejects(Effect.runPromise(broken.list("/source")), (error) => error === failure);
  });

  test("discovers siblings and descendants from a snapshot, skipping missing entries", async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "kompass-rift-list-")));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = path.join(root, "source");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    const nested = path.join(root, "nested");
    await Promise.all([source, first, second, nested].map((directory) => mkdir(directory)));
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      ancestors: () => [source],
      list: ({ of } = {}) => of === source ? [first, second, first, path.join(root, "missing")] : of === first ? [nested] : [],
    })));
    assert.deepEqual(await Effect.runPromise(strategy.list(first)), [
      { directory: source, type: "root" },
      { directory: first, type: "worktree" },
      { directory: second, type: "worktree" },
      { directory: nested, type: "worktree" },
    ]);
  });

  test("removes only a snapshot root and never cascades to children, even with force", async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "kompass-rift-remove-")));
    t.after(() => rm(root, { recursive: true, force: true }));
    const child = path.join(root, "child");
    await mkdir(child);
    const removed: string[] = [];
    let children: string[] = [];
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      ancestors: ({ of } = {}) => of === root ? [] : [root],
      list: ({ of } = {}) => of === root ? [child] : children,
      remove: (options) => { removed.push(options!.at!); },
    })));
    await assert.rejects(Effect.runPromise(strategy.remove({ directory: root, force: true })), /Not a Rift snapshot root/);
    const subdirectory = path.join(child, "subdirectory");
    await mkdir(subdirectory);
    await assert.rejects(Effect.runPromise(strategy.remove({ directory: subdirectory, force: true })), /Not a Rift snapshot root/);
    children = ["descendant"];
    await assert.rejects(Effect.runPromise(strategy.remove({ directory: child, force: true })), /child snapshots first/);
    assert.deepEqual(removed, []);
    children = [];
    await Effect.runPromise(strategy.remove({ directory: child, force: true }));
    assert.deepEqual(removed, [child]);
  });

  test("requests force for uncommitted files and allows a clean snapshot's Rift marker", async (t) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "kompass-rift-dirty-")));
    t.after(() => rm(root, { recursive: true, force: true }));
    const snapshot = path.join(root, "snapshot");
    await mkdir(snapshot);
    await execFileAsync("git", ["init", snapshot]);
    // Rift itself excludes its marker in the snapshot's Git metadata.
    await writeFile(path.join(snapshot, ".git", "info", "exclude"), ".rift\n");
    await writeFile(path.join(snapshot, ".rift"), "rift-marker");
    await writeFile(path.join(snapshot, "user.txt"), "uncommitted");
    let removed = 0;
    const strategy = createRiftWorktreeStrategy(Effect.succeed(backend({
      ancestors: () => [root],
      list: ({ of } = {}) => of === root ? [snapshot] : [],
      remove: () => { removed++; },
    })));
    await assert.rejects(Effect.runPromise(strategy.remove({ directory: snapshot, force: false })),
      (error) => error instanceof Worktree.OperationError && error.forceRequired === true);
    assert.equal(removed, 0);
    await Effect.runPromise(strategy.remove({ directory: snapshot, force: true }));
    assert.equal(removed, 1);
    await rm(path.join(snapshot, "user.txt"));
    await Effect.runPromise(strategy.remove({ directory: snapshot, force: false }));
    assert.equal(removed, 2);
  });
});
