import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createToolContextForDirectory, createShellForDirectory } from "../scripts/_tool-runner.ts";
import { createChangesLoadTool } from "../tools/changes-load.ts";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("changes_load e2e", () => {
  test("dirty worktree returns only local changes and no commits", async () => {
    const repo = await createRepo();
    await commitFile(repo, "notes.txt", "hello\n", "init");
    await writeFile(path.join(repo, "notes.txt"), "hello\nworld\n", "utf8");

    const result = await runChangesLoad(repo, {});

    assert.equal(result.comparison, "uncommitted");
    assert.equal(result.branch, "main");
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].status, "modified");
    assert.equal(result.files[0].path, "notes.txt");
    assert.match(String(result.files[0].diff), /@/);
    assert.equal(result.commits, undefined);
  });

  test("dirty worktree rename is detected without touching user index", async () => {
    const repo = await createRepo();
    await commitFile(repo, "commands/pr/review.txt", "line one\nline two\n", "init");
    await mkdir(path.join(repo, "commands/pr"), { recursive: true });
    await rename(path.join(repo, "commands/pr/review.txt"), path.join(repo, "commands/pr/review2.txt"));
    await writeFile(path.join(repo, "commands/pr/review2.txt"), "line one\nline two\nextra\n", "utf8");

    const result = await runChangesLoad(repo, {});

    assert.equal(result.comparison, "uncommitted");
    assert.equal(result.branch, "main");
    assert.equal(result.files.length, 1);
    assert.deepEqual(
      {
        status: result.files[0].status,
        previousPath: result.files[0].previousPath,
        path: result.files[0].path,
      },
      {
      status: "renamed",
      previousPath: "commands/pr/review.txt",
      path: "commands/pr/review2.txt",
      },
    );
    assert.match(String(result.files[0].diff), /@@/);
    const status = await git(repo, ["status", "--short"]);
    assert.match(status, / D commands\/pr\/review.txt/);
    assert.match(status, /\?\? commands\/pr\/review2.txt/);
  });

  test("explicit comparison returns commits and omits added-file diff", async () => {
    const repo = await createRepo();
    await commitFile(repo, "base.txt", "base\n", "init");
    await git(repo, ["checkout", "-b", "feature"]);
    await writeFile(path.join(repo, "new-file.txt"), "new\nfile\n", "utf8");
    await git(repo, ["add", "new-file.txt"]);
    await git(repo, ["commit", "-m", "add file"]);

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD" });

    assert.equal(result.comparison, "main...HEAD");
    assert.equal(result.branch, "feature");
    assert.equal(result.commits.length, 1);
    assert.deepEqual(result.files, [
      {
        status: "added",
        path: "new-file.txt",
        diffOmittedReason: "added file; read current file contents instead",
      },
    ]);
  });

  test("explicit deletion keeps diff content", async () => {
    const repo = await createRepo();
    await commitFile(repo, "remove-me.txt", "gone\nsoon\n", "init");
    await git(repo, ["checkout", "-b", "feature"]);
    await git(repo, ["rm", "remove-me.txt"]);
    await git(repo, ["commit", "-m", "remove file"]);

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD" });

    assert.equal(result.comparison, "main...HEAD");
    assert.equal(result.branch, "feature");
    assert.equal(result.files.length, 1);
    assert.deepEqual(
      {
        status: result.files[0].status,
        path: result.files[0].path,
      },
      {
      status: "deleted",
      path: "remove-me.txt",
      },
    );
    assert.match(String(result.files[0].diff), /@@/);
    assert.match(String(result.files[0].diff), /-gone/);
  });

  test("binary changes omit diff body", async () => {
    const repo = await createRepo();
    await writeFile(path.join(repo, "image.bin"), Buffer.from([0, 1, 2, 3]));
    await git(repo, ["add", "image.bin"]);
    await git(repo, ["commit", "-m", "add binary"]);
    await git(repo, ["checkout", "-b", "feature"]);
    await writeFile(path.join(repo, "image.bin"), Buffer.from([9, 8, 7, 6, 5]));
    await git(repo, ["add", "image.bin"]);
    await git(repo, ["commit", "-m", "update binary"]);

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD" });

    assert.equal(result.comparison, "main...HEAD");
    assert.equal(result.branch, "feature");
    assert.equal(result.files.length, 1);
    assert.deepEqual(result.files[0], {
      status: "modified",
      path: "image.bin",
      diffOmittedReason: "binary change; inspect file contents or metadata directly",
    });
  });

  test("uncommitted: true forces workspace mode on clean worktree", async () => {
    const repo = await createRepo();
    await commitFile(repo, "notes.txt", "hello\n", "init");
    await git(repo, ["checkout", "-b", "feature"]);
    await commitFile(repo, "feature.txt", "new\n", "feature commit");

    // With uncommitted: true on clean worktree, should return empty files
    // and NOT fall back to branch comparison
    const result = await runChangesLoad(repo, { uncommitted: true });

    assert.equal(result.comparison, "uncommitted");
    assert.equal(result.branch, "feature");
    assert.deepEqual(result.files, []);
    assert.equal(result.commits, undefined);
  });

  test("uncommitted: true returns changes on dirty worktree", async () => {
    const repo = await createRepo();
    await commitFile(repo, "notes.txt", "hello\n", "init");
    await writeFile(path.join(repo, "notes.txt"), "hello\nworld\n", "utf8");

    const result = await runChangesLoad(repo, { uncommitted: true });

    assert.equal(result.comparison, "uncommitted");
    assert.equal(result.branch, "main");
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].path, "notes.txt");
    assert.equal(result.files[0].status, "modified");
    assert.equal(result.commits, undefined);
  });

  test("branch comparison returns commits", async () => {
    const repo = await createRepo();
    await commitFile(repo, "base.txt", "base\n", "init");
    await git(repo, ["checkout", "-b", "feature"]);
    await commitFile(repo, "file1.txt", "content1\n", "first commit");
    await commitFile(repo, "file2.txt", "content2\n", "second commit");

    const result = await runChangesLoad(repo, {});

    // Comparison format depends on whether origin/main exists (fresh repo vs cloned)
    assert.ok(result.comparison.endsWith("main...HEAD"), `Expected comparison to end with main...HEAD, got: ${result.comparison}`);
    assert.equal(result.branch, "feature");
    assert.ok(result.commits);
    assert.equal(result.commits.length, 2);
    // Commits are in reverse chronological order (newest first)
    assert.match(result.commits[0].subject, /second commit/);
    assert.match(result.commits[1].subject, /first commit/);
  });

  test("invalid depthHint is ignored during branch comparison", async () => {
    const repo = await createRepo();
    await commitFile(repo, "base.txt", "base\n", "init");
    await git(repo, ["checkout", "-b", "feature"]);
    await commitFile(repo, "file1.txt", "content1\n", "first commit");

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD", depthHint: -5 });

    assert.equal(result.comparison, "main...HEAD");
    assert.equal(result.branch, "feature");
    assert.equal(result.commits.length, 1);
    assert.match(result.commits[0].subject, /first commit/);
  });

  test("explicit comparison deepens shallow refs before diffing", async () => {
    const remote = await createRepo();
    await commitFile(remote, "base.txt", "base\n", "init");
    await git(remote, ["checkout", "-b", "feature/misc"]);
    await commitFile(remote, "feature.txt", "feature\n", "feature commit");
    await git(remote, ["checkout", "main"]);
    await commitFile(remote, "main.txt", "main\n", "main commit");

    const bare = await cloneBare(remote);
    const clone = await cloneShallowBranch(bare, "feature/misc");
    await git(clone, ["fetch", "--depth=1", "origin", "main:refs/remotes/origin/main"]);

    const result = await runChangesLoad(clone, { base: "main", head: "feature/misc", depthHint: 1 });

    assert.equal(result.comparison, "origin/main...origin/feature/misc");
    assert.equal(result.branch, "feature/misc");
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].path, "feature.txt");
    assert.equal(result.files[0].status, "added");
    assert.equal(result.commits.length, 1);
    assert.match(result.commits[0].subject, /feature commit/);
  });

  test("branch comparison refreshes stale base branch before diffing", async () => {
    const remote = await createRepo();
    await commitFile(remote, "base.txt", "base\n", "init");
    await git(remote, ["checkout", "-b", "feature"]);
    await commitFile(remote, "feature.txt", "feature\n", "feature commit");
    await git(remote, ["checkout", "main"]);

    const bare = await cloneBare(remote);
    await git(remote, ["remote", "add", "origin", `file://${bare}`]);
    const clone = await cloneShallowBranch(bare, "feature");
    await git(clone, ["fetch", "--depth=1", "origin", "main:refs/remotes/origin/main"]);

    await git(remote, ["merge", "--ff-only", "feature"]);
    await git(remote, ["push", "origin", "main"]);

    const result = await runChangesLoad(clone, { base: "main", head: "feature" });

    assert.equal(result.comparison, "origin/main...origin/feature");
    assert.equal(result.branch, "feature");
    assert.deepEqual(result.files, []);
    assert.equal(result.commits, undefined);
  });

});

async function createRepo() {
  const repo = await mkdtemp(path.join(os.tmpdir(), "kompass-test-"));
  tempDirs.push(repo);
  await git(repo, ["init", "-b", "main"]);
  await git(repo, ["config", "user.name", "OpenCode Test"]);
  await git(repo, ["config", "user.email", "test@example.com"]);
  return repo;
}

async function commitFile(repo: string, relativePath: string, contents: string, message: string) {
  await mkdir(path.dirname(path.join(repo, relativePath)), { recursive: true });
  await writeFile(path.join(repo, relativePath), contents, "utf8");
  await git(repo, ["add", relativePath]);
  await git(repo, ["commit", "-m", message]);
}

async function cloneBare(repo: string) {
  const bare = await mkdtemp(path.join(os.tmpdir(), "kompass-remote-"));
  tempDirs.push(bare);
  await git(path.dirname(repo), ["clone", "--bare", repo, bare]);
  return bare;
}

async function cloneShallowBranch(remote: string, branch: string) {
  const clone = await mkdtemp(path.join(os.tmpdir(), "kompass-clone-"));
  tempDirs.push(clone);
  await rm(clone, { recursive: true, force: true });
  await git(path.dirname(remote), [
    "clone",
    "--depth",
    "1",
    "--branch",
    branch,
    `file://${remote}`,
    clone,
  ]);
  return clone;
}

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return stdout;
}

async function runChangesLoad(
  repo: string,
  args: { base?: string; head?: string; depthHint?: number; uncommitted?: boolean },
) {
  const tool = createChangesLoadTool(createShellForDirectory(repo));
  const output = await tool.execute(args, createToolContextForDirectory(repo));
  return JSON.parse(output);
}
