import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { applySkillsConfig } from "../config.ts";

describe("applySkillsConfig", () => {
  test.skip("registers the bundled Kompass skills path", async () => {
    const cfg: { skills?: { paths?: string[] } } = {};

    await applySkillsConfig(cfg as never);

    assert.ok(cfg.skills?.paths);
    assert.equal(cfg.skills.paths.length, 1);
    assert.match(cfg.skills.paths[0], /packages\/(core|opencode)\/skills$/);
  });

  test.skip("preserves existing skill paths without duplicates", async () => {
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
});
