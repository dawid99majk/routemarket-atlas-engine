import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject } from "../packages/atlas-core/src/index.js";
import { collectSources } from "../packages/atlas-research/src/index.js";

let tempRoots: string[] = [];

describe("source collection", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("writes mock sources to sources.json", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-sources-"));
    tempRoots.push(rootDir);

    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });

    const sources = await collectSources({ project });
    const saved = await readFile(join(project.folderPath, "sources.json"), "utf8");
    const notes = await readFile(join(project.folderPath, "notes.md"), "utf8");

    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(saved).toContain("source_001");
    expect(saved).toContain("official");
    expect(notes).toContain("Provider: mock");
  });
});
