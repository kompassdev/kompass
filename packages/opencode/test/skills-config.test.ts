import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { applySkillsConfig } from "../config.ts";

describe("applySkillsConfig", () => {
  test("registers the bundled Kompass skills path", async () => {
    const cfg: { skills?: { paths?: string[] } } = {};

    await applySkillsConfig(cfg as never);

    assert.ok(cfg.skills?.paths);
    assert.equal(cfg.skills.paths.length, 1);
    assert.match(cfg.skills.paths[0], /packages\/(core|opencode)\/skills$/);
  });

  test("preserves existing skill paths without duplicates", async () => {
    const cfg: { skills?: { paths?: string[] } } = {
      skills: {
        paths: ["/tmp/custom-skills"],
      },
    };

    await applySkillsConfig(cfg as never);
    await applySkillsConfig(cfg as never);

    assert.deepEqual(cfg.skills?.paths?.slice(0, 1), ["/tmp/custom-skills"]);
    assert.equal(cfg.skills?.paths?.length, 2);
    assert.match(cfg.skills?.paths?.[1] ?? "", /packages\/(core|opencode)\/skills$/);
  });

  test("filters invalid configured skill paths before appending bundled path", async () => {
    const cfg: { skills?: { paths?: unknown[] } } = {
      skills: {
        paths: [undefined, "", "/tmp/custom-skills"],
      },
    };

    await applySkillsConfig(cfg as never);

    assert.deepEqual(cfg.skills?.paths?.slice(0, 1), ["/tmp/custom-skills"]);
    assert.equal(cfg.skills?.paths?.length, 2);
    assert.equal(typeof cfg.skills?.paths?.[1], "string");
  });

  test("preserves valid configured skill paths when no bundled skills root exists", async () => {
    const cfg: { skills?: { paths?: unknown[] } } = {
      skills: {
        paths: [undefined, "", "/tmp/custom-skills"],
      },
    };

    await applySkillsConfig(cfg as never, {
      resolveBundledSkillsRoot: async () => undefined,
    });

    assert.deepEqual(cfg.skills?.paths, ["/tmp/custom-skills"]);
  });
});
