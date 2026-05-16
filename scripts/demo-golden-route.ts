import { AtlasWorkflowService } from "../packages/atlas-workflow/src/index.js";
import { join } from "node:path";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { generateClaims, extractPois } from "../packages/atlas-research/src/index.js";
import { generateGuideV2, writeGuideOutline, generateRouteConcept, generateRouteTips, generateRecommendations, prepareMediaPack, generateQualityReport, writeReviewChecklist } from "../packages/atlas-writer/src/index.js";
import { loadProject } from "../apps/cli/src/commands/load-project.js";
import { assessProjectReadiness } from "../packages/atlas-workflow/src/readiness.js";
import { checkQualityGates } from "../packages/atlas-workflow/src/quality-gates.js";

export async function runGoldenRoutePipeline(rootDir: string, slug: string = "golden-motorcycle-route") {
  const service = new AtlasWorkflowService({ rootDir });
  const projectPath = join(rootDir, "routes", slug);

  console.log("--- STARTING GOLDEN ROUTE DEMO ---");
  await rm(projectPath, { recursive: true, force: true });
  
  // 1. Create Project
  console.log("\n[1/8] Creating project...");
  const project = await service.createProject({
    topic: slug.split('-').join(' '),
    category: "motorcycle",
    region: "Albania",
    language: "en"
  });
  
  // Update slug just to be sure we are working with correct one
  if (project.id !== slug) {
      project.id = slug;
      project.slug = slug;
      project.folderPath = projectPath;
      await writeFile(join(projectPath, "project.json"), JSON.stringify(project, null, 2));
  }

  // 2. Add Input (simulated)
  console.log("[2/8] Adding input materials...");
  await copyFile(join(rootDir, "fixtures", "golden-route", "route.gpx"), join(projectPath, "route.gpx"));
  await copyFile(join(rootDir, "fixtures", "golden-route", "notes.md"), join(projectPath, "notes.md"));
  await copyFile(join(rootDir, "fixtures", "golden-route", "sources.json"), join(projectPath, "sources.json"));
  
  await writeFile(join(projectPath, "input_manifest.json"), JSON.stringify({
    projectId: slug,
    items: [
      { id: "note_1", type: "note", originalName: "Albania Tips", path: "notes.md", status: "usable" },
      { id: "gpx_1", type: "gpx", originalName: "route.gpx", path: "route.gpx", status: "usable" }
    ]
  }, null, 2));

  // 3. Build research pack
  console.log("\n[3/8] Building research pack...");
  await service.buildResearchPack(slug);

  // 4. Analyze GPX
  console.log("[4/8] Analyzing GPX...");
  await service.analyzeGpx(slug);
  await service.approveStage(slug, "gpx_summary_approval", "approved", "Auto-approved GPX");

  // 5. Generate claims and POIs
  console.log("[5/8] Generating claims and POIs...");
  const loadedProject = await loadProject(rootDir, slug);
  await generateClaims(loadedProject);
  await extractPois(loadedProject);
  
  // 6. Simulate Approvals
  console.log("[6/8] Simulating Approvals...");
  await service.approveStage(slug, "claims_approval", "approved", "Auto-approved claims");
  await service.approveStage(slug, "poi_approval", "approved", "Auto-approved POIs");

  console.log("[7/8] Generating concepts, outline, and final guide...");
  const sourcesText = await readFile(join(projectPath, "sources.json"), "utf8");
  const sources = JSON.parse(sourcesText);
  await generateRouteConcept({ project: loadedProject, sources });
  await service.approveStage(slug, "concept_approval", "approved", "Auto-approved concept");
  
  await writeGuideOutline(loadedProject);
  await service.approveStage(slug, "guide_outline_approval", "approved", "Auto-approved outline");

  await generateGuideV2(loadedProject);
  await service.approveStage(slug, "guide_final_approval", "approved", "Auto-approved final guide");

  // Finalize other required artifacts for publish readiness
  await generateRouteTips(loadedProject);
  await generateRecommendations(loadedProject);
  await prepareMediaPack(loadedProject);
  await writeReviewChecklist(loadedProject);
  await generateQualityReport({ project: loadedProject, sources, gpxValid: true, geojsonValid: true });

  // 8. Prepare Publish
  console.log("[8/8] Preparing to publish (dry-run)...");
  try {
      const draft = await service.preparePublish(slug);
      console.log(`\nRouteMarket Payload Prepared (dry-run mode)`);
      console.log(`- Project: ${slug}`);
      console.log(`- Payload saved to: ${slug}/routemarket_payload.json`);
  } catch (err: any) {
      if (err.name === "QualityGateError") {
          console.error(`\n[BLOCKED] Quality Gates failed for project ${slug}. Preparation aborted.`);
          for (const issue of err.issues) {
            console.error(` - [${issue.rule}] ${issue.message}`);
          }
          throw err;
      }
      throw err;
  }
  
  console.log("\n--- DEMO COMPLETED ---");
}

import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGoldenRoutePipeline(process.cwd()).catch(err => {
      console.error(err);
      process.exit(1);
  });
}
