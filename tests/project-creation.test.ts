import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject } from "../packages/atlas-core/src/index.js";

let tempRoots: string[] = [];

describe("route project creation", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("creates the expected starter files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-project-"));
    tempRoots.push(rootDir);

    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });

    expect(project.id).toBe("albania-motorcycle-route-7-days");
    await expect(readFile(join(project.folderPath, "project.json"), "utf8")).resolves.toContain(project.id);
    const sources = JSON.parse(await readFile(join(project.folderPath, "sources.json"), "utf8")) as unknown[];
    expect(sources).toEqual([]);
    await expect(readFile(join(project.folderPath, "quality_report.md"), "utf8")).resolves.toContain("Quality Report");
  });
});
