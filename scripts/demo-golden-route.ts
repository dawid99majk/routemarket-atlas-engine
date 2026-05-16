import { AtlasWorkflowService } from "../packages/atlas-workflow/src/index.js";
import { join } from "node:path";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

async function run() {
  const rootDir = process.cwd();
  const service = new AtlasWorkflowService({ rootDir });
  const slug = "golden-alps";
  const projectPath = join(rootDir, "routes", "the-golden-alps");

  console.log("--- STARTING GOLDEN ROUTE DEMO ---");
  await rm(projectPath, { recursive: true, force: true });
  
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
  await copyFile(join(rootDir, "fixtures", "golden-route", "route.gpx"), join(projectPath, "route.gpx"));
  await copyFile(join(rootDir, "fixtures", "golden-route", "notes.md"), join(projectPath, "notes.md"));
  await copyFile(join(rootDir, "fixtures", "golden-route", "sources.json"), join(projectPath, "sources.json"));
  
  await writeFile(join(projectPath, "input_manifest.json"), JSON.stringify({
    projectId: "the-golden-alps",
    items: [
      { id: "note_1", type: "note", originalName: "Albania Tips", path: "notes.md", status: "usable" }
    ]
  }, null, 2));
  
  await mkdir(join(projectPath, "input", "photos"), { recursive: true });
  await writeFile(join(projectPath, "input", "photos", "cover.jpg"), "fake-image-content");

  // 3. Run Pipeline (Pause 1: GPX)
  console.log("\n[3/5] Running pipeline - Step: Input & GPX...");
  let res = await service.runMvp2WithProgress("the-golden-alps");
  console.log(`Pipeline paused at: ${res.step}. Approving...`);
  await service.approveStage("the-golden-alps", "gpx_summary_approval", "approved");

  // 4. Continue Pipeline (Wait for all approvals)
  console.log("\n[4/5] Running pipeline and approving stages...");
  const autoApprover = async () => {
    while (true) {
      res = await service.runMvp2WithProgress("the-golden-alps");
      if (res.status === "completed") break;
      if (res.status === "paused") {
        const stageToApprove = (res as any).stage || res.step;
        console.log(`Auto-approving: ${stageToApprove}`);
        await service.approveStage("the-golden-alps", stageToApprove, "approved");
      } else {
        break;
      }
    }
  };
  await autoApprover();
  
  console.log("\n--- DEMO COMPLETED ---");
  console.log(`Project ready: routes/the-golden-alps`);
  console.log(`Payload: routes/the-golden-alps/routemarket_payload.json`);
}

run().catch(console.error);
