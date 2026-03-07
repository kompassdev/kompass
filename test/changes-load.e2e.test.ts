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

    assert.deepEqual(result, {
      files: [{ status: "modified", path: "notes.txt" }],
    });
  });

  test("dirty worktree rename is detected without touching user index", async () => {
    const repo = await createRepo();
    await commitFile(repo, "commands/pr/review.txt", "line one\nline two\n", "init");
    await mkdir(path.join(repo, "commands/pr"), { recursive: true });
    await rename(path.join(repo, "commands/pr/review.txt"), path.join(repo, "commands/pr/review2.txt"));
    await writeFile(path.join(repo, "commands/pr/review2.txt"), "line one\nline two\nextra\n", "utf8");

    const result = await runChangesLoad(repo, { diff: true });

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

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD", diff: true });

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

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD", diff: true });

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

    const result = await runChangesLoad(repo, { base: "main", head: "HEAD", diff: true });

    assert.equal(result.files.length, 1);
    assert.deepEqual(result.files[0], {
      status: "modified",
      path: "image.bin",
      diffOmittedReason: "binary change; inspect file contents or metadata directly",
    });
  });
});

async function createRepo() {
  const repo = await mkdtemp(path.join(os.tmpdir(), "opencode-compass-test-"));
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

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return stdout;
}

async function runChangesLoad(
  repo: string,
  args: { base?: string; head?: string; depthHint?: number; diff?: boolean },
) {
  const tool = createChangesLoadTool(createShellForDirectory(repo));
  const output = await tool.execute(args, createToolContextForDirectory(repo));
  return JSON.parse(output);
}
