import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject } from "../packages/atlas-core/src/index.js";
import { getRouteMarketCategoryId, prepareRouteMarketDraft } from "../packages/atlas-publisher/src/index.js";
import { generateGuideDraft } from "../packages/atlas-writer/src/index.js";

let tempRoots: string[] = [];

describe("RouteMarket publisher payload", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("maps Atlas categories to RouteMarket IDs", () => {
    expect(getRouteMarketCategoryId("motorcycle")).toBe(4);
    expect(getRouteMarketCategoryId("city_walk")).toBe(9);
  });

  it("prepares a draft payload from local project files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-publish-"));
    tempRoots.push(rootDir);
    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    await generateGuideDraft({ project, sources: [] });
    await writeFile(
      join(project.folderPath, "route_summary.json"),
      JSON.stringify({ difficulty: "hard", distanceKm: 420, riskLevel: "medium", loopType: "loop" }),
      "utf8"
    );

    const prepared = await prepareRouteMarketDraft(project);
    const saved = await readFile(join(project.folderPath, "routemarket_payload.json"), "utf8");

    expect(prepared.draft.category_id).toBe(4);
    expect(prepared.draft.difficulty).toBe("hard");
    expect(prepared.draft.distance_km).toBe(420);
    expect(saved).toContain("Albania motorcycle route 7 days");
  });
});
