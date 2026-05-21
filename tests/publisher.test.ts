import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject, FileProjectRepository } from "../packages/atlas-core/src/index.js";
import { buildResearchPack, generateClaims, analyzeGpx } from "../packages/atlas-research/src/index.js";
import { getRouteMarketCategoryId, prepareRouteMarketDraft } from "../packages/atlas-publisher/src/index.js";
import { generateGuideV2, generateQualityReport, generateRecommendations, generateRouteConcept, generateRouteTips, prepareMediaPack, writeGuideOutline, writeReviewChecklist } from "../packages/atlas-writer/src/index.js";
import { saveProjectApprovalDecision } from "../packages/atlas-workflow/src/index.js";
import { checkQualityGates } from "../packages/atlas-workflow/src/quality-gates.js";

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
    await copyFile(join(process.cwd(), "fixtures", "golden-route", "route.gpx"), join(project.folderPath, "route.gpx"));
    await copyFile(join(process.cwd(), "fixtures", "golden-route", "notes.md"), join(project.folderPath, "notes.md"));
    await copyFile(join(process.cwd(), "fixtures", "golden-route", "sources.json"), join(project.folderPath, "sources.json"));
    await writeFile(join(project.folderPath, "input_manifest.json"), JSON.stringify({
      projectId: project.id,
      updatedAt: new Date().toISOString(),
      items: [{
        id: "note_1",
        type: "note",
        path: "notes.md",
        originalName: "notes.md",
        mimeType: "text/markdown",
        sizeBytes: 500,
        addedAt: new Date().toISOString(),
        status: "added"
      }]
    }, null, 2), "utf8");

    await buildResearchPack(project);
    await analyzeGpx(project);
    await generateClaims(project);
    await generateRouteConcept({ project, sources: [] });
    await writeGuideOutline(project);
    const repository = new FileProjectRepository(rootDir);
    for (const stage of ["gpx_summary_approval", "claims_approval", "poi_approval", "concept_approval", "guide_outline_approval"] as const) {
      await saveProjectApprovalDecision({ project, repository, stage, decision: "approved" });
    }
    await generateGuideV2(project);
    await saveProjectApprovalDecision({ project, repository, stage: "guide_final_approval", decision: "approved" });
    await generateRouteTips(project);
    await generateRecommendations(project);
    await prepareMediaPack(project);
    await generateQualityReport({ project, sources: [], gpxValid: true, geojsonValid: true });
    await writeReviewChecklist(project);

    const prepared = await prepareRouteMarketDraft(project);
    const saved = await readFile(join(project.folderPath, "routemarket_payload.json"), "utf8");

    expect(prepared.draft.category_id).toBe(4);
    expect(prepared.contractVersion).toBe("2.1");
    expect(prepared.publishMode).toBe("draft");
    expect(prepared.canImportToRouteMarket).toBe(true);
    expect(prepared.creationSource).toBe("atlas_ai");
    expect(prepared.draftOnlyMode).toBe(true);
    expect(prepared.payloadId).toHaveLength(16);
    expect(prepared.generatedAt).toMatch(/T/);
    expect(prepared.importReadiness.canImportToRouteMarket).toBe(true);
    expect(prepared.importReadiness.blockingReasons).toEqual([]);
    expect(prepared.importPolicy.importNeverPublishes).toBe(true);
    expect(prepared.importPolicy.preserveManualEditsByDefault).toBe(true);
    expect(Object.keys(prepared.sourceArtifactHashes).length).toBeGreaterThan(0);
    expect(prepared.qualityGateResult.passed).toBe(true);
    expect(prepared.claimsSummary.verified).toBeGreaterThan(0);
    expect(prepared.routeSummary?.routeSegments.length).toBeGreaterThan(0);
    expect(prepared.draft.difficulty).toBe("moderate");
    expect(prepared.draft.distance_km).toBeGreaterThan(1);
    expect(saved).toContain("Albania motorcycle route 7 days");
    expect(saved).toContain('"creationSource": "atlas_ai"');
    expect(saved).toContain('"publishMode": "draft"');
  });

  it("blocks legacy guide draft from passing quality gates", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-legacy-guide-"));
    tempRoots.push(rootDir);
    const project = await createRouteProject({
      rootDir,
      title: "Legacy guide route",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });

    await writeFile(join(project.folderPath, "guide.md"), `# Legacy guide

This route covers...

- Distance: needs GPX validation
- Duration: needs validation
- Surface: needs confirmation
`, "utf8");
    await writeFile(join(project.folderPath, "sources.json"), JSON.stringify([], null, 2), "utf8");
    await writeFile(join(project.folderPath, "claims.json"), JSON.stringify([], null, 2), "utf8");
    await writeFile(join(project.folderPath, "approvals.json"), JSON.stringify({ projectId: project.id, approvals: [] }, null, 2), "utf8");

    const issues = await checkQualityGates(project);
    expect(issues.some((issue) => issue.rule === "placeholder_in_guide")).toBe(true);
  });
});
