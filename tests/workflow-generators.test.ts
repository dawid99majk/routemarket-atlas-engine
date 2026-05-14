import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject, readJsonFile, updateProjectStatus, type MediaManifest, type RouteProject } from "../packages/atlas-core/src/index.js";
import { collectSources, extractPois, generateClaims, runDeepResearch } from "../packages/atlas-research/src/index.js";
import { generateRecommendations, generateRouteTips, prepareMediaPack, writeReviewChecklist } from "../packages/atlas-writer/src/index.js";

let tempRoots: string[] = [];

describe("workflow generators", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("generates claims, POI, tips, recommendations, media and review files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-workflow-"));
    tempRoots.push(rootDir);
    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });
    const sources = await collectSources({ project });
    const claims = await generateClaims(project);
    const pois = await extractPois(project);
    const deepResearch = await runDeepResearch({ project, sourceLimit: 1 });
    const tips = await generateRouteTips(project);
    const recommendations = await generateRecommendations(project);
    const media = await prepareMediaPack(project);
    const checklist = await writeReviewChecklist(project);
    const updated = await updateProjectStatus(project, "ready_for_review");
    const savedProject = await readJsonFile<RouteProject>(join(project.folderPath, "project.json"));
    const savedSources = await readJsonFile<any[]>(join(project.folderPath, "sources.json"));
    const savedClaims = await readJsonFile<any[]>(join(project.folderPath, "claims.json"));

    expect(claims.length).toBeGreaterThan(0);
    expect(pois.length).toBe(0);
    expect(deepResearch.processedSourceCount).toBe(1);
    expect(deepResearch.addedClaimCount).toBe(1);
    expect(savedSources[0].deepResearchStatus).toBe("processed");
    expect(savedSources[0].rawContentPath).toContain("research");
    expect(savedClaims.length).toBeGreaterThan(0);
    expect(tips.some((tip) => tip.category === "before_start_fuel")).toBe(true);
    expect(recommendations).toHaveLength(1);
    expect(media.assets[0].role).toBe("cover_candidate");
    expect(checklist).toContain("Human approved before publish");
    expect(updated.status).toBe("ready_for_review");
    expect(savedProject.status).toBe("ready_for_review");
  });
});
