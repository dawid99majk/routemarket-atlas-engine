import { AtlasWorkflowService } from "../packages/atlas-workflow/src/index.js";
import { join } from "node:path";
import { copyFile, mkdir } from "node:fs/promises";

async function run() {
  const rootDir = process.cwd();
  const service = new AtlasWorkflowService({ rootDir });
  const slug = "golden-alps";

  console.log("--- STARTING GOLDEN ROUTE DEMO ---");
  
  // 1. Create Project
  console.log("\n[1/5] Creating project...");
  await service.createProject({
    topic: "The Golden Alps",
    category: "motorcycle",
    region: "Albania",
    language: "en"
  });

  // 2. Add Input (simulated)
  console.log("[2/5] Adding input materials...");
  const projectPath = join(rootDir, "routes", "the-golden-alps");
  await copyFile(join(rootDir, "fixtures", "golden-route", "route.gpx"), join(projectPath, "route.gpx"));
  await copyFile(join(rootDir, "fixtures", "golden-route", "notes.md"), join(projectPath, "notes.md"));

  // 3. Run Pipeline (Pause 1: GPX)
  console.log("\n[3/5] Running pipeline - Step: Input & GPX...");
  let res = await service.runMvp2WithProgress("the-golden-alps");
  console.log(`Pipeline paused at: ${res.step}. Approving...`);
  await service.approveStage("the-golden-alps", "gpx_summary_approval", "approved");

  // 4. Continue Pipeline (Pause 2: Claims)
  console.log("\n[4/5] Running pipeline - Step: Claims...");
  res = await service.runMvp2WithProgress("the-golden-alps", undefined, "claims");
  console.log(`Pipeline paused at: ${res.step}. Approving...`);
  await service.approveStage("the-golden-alps", "claims_approval", "approved");

  // 5. Finalize
  console.log("\n[5/5] Finalizing pipeline...");
  await service.approveStage("the-golden-alps", "poi_approval", "approved");
  await service.approveStage("the-golden-alps", "concept_approval", "approved");
  await service.approveStage("the-golden-alps", "guide_outline_approval", "approved");
  await service.approveStage("the-golden-alps", "guide_final_approval", "approved");
  await service.approveStage("the-golden-alps", "media_approval", "approved");

  res = await service.runMvp2WithProgress("the-golden-alps", undefined, "finalize");
  
  console.log("\n--- DEMO COMPLETED ---");
  console.log(`Project ready: routes/the-golden-alps`);
  console.log(`Payload: routes/the-golden-alps/routemarket_payload.json`);
}

run().catch(console.error);
