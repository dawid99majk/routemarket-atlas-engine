import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject } from "../packages/atlas-core/src/index.js";
import { collectSources } from "../packages/atlas-research/src/index.js";
import { generateResearchBrief } from "../packages/atlas-writer/src/index.js";

let tempRoots: string[] = [];

describe("research brief generation", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("generates a brief with questions and sources", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-brief-"));
    tempRoots.push(rootDir);

    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    const sources = await collectSources({ project });
    const brief = await generateResearchBrief({ project, sources });
    const saved = await readFile(join(project.folderPath, "brief.md"), "utf8");

    expect(brief).toContain("Research questions");
    expect(brief).toContain("adventure motorcycle traveler");
    expect(saved).toContain(sources[0].title);
  });
});
