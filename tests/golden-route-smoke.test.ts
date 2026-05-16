import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGoldenRoutePipeline } from "../scripts/demo-golden-route.js";
import { readJsonFile } from "../packages/atlas-core/src/index.js";
import { readFile, stat } from "node:fs/promises";

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("Golden Route Smoke Test", () => {
  it("runs the full golden route pipeline successfully", async () => {
    const rootDir = process.cwd();
    const slug = `golden-motorcycle-route-test-${Date.now()}`;
    const projectPath = join(rootDir, "routes", slug);

    // Run the full pipeline
    await runGoldenRoutePipeline(rootDir, slug);

    // Asserts

    // 1. route_summary.json exists and has validationStatus === "validated"
    const summaryPath = join(projectPath, "route_summary.json");
    expect(await fileExists(summaryPath)).toBe(true);
    const summary = await readJsonFile<any>(summaryPath);
    expect(summary.validationStatus).toBe("validated");

    // 2. route_segments.geojson exists
    const segmentsPath = join(projectPath, "route_segments.geojson");
    expect(await fileExists(segmentsPath)).toBe(true);

    // 3. claims.json exists and has "verified" or "likely" claims
    const claimsPath = join(projectPath, "claims.json");
    expect(await fileExists(claimsPath)).toBe(true);
    const claims = await readJsonFile<any[]>(claimsPath);
    const hasVerifiedOrLikely = claims.some(c => c.status === "verified" || c.status === "likely");
    expect(hasVerifiedOrLikely).toBe(true);

    // 4. guide.md exists and is not empty
    const guidePath = join(projectPath, "guide.md");
    expect(await fileExists(guidePath)).toBe(true);
    const guideContent = await readFile(guidePath, "utf8");
    expect(guideContent.length).toBeGreaterThan(0);
    expect(guideContent.includes("todo")).toBe(false); // Check no placeholder lowercase

    // 5. missing_inputs.json does not have blocking: true
    const missingInputsPath = join(projectPath, "missing_inputs.json");
    if (await fileExists(missingInputsPath)) {
      const missingInputs = await readJsonFile<any>(missingInputsPath);
      expect(missingInputs.blocking).not.toBe(true);
    }

    // 6. routemarket_payload.json is generated
    const payloadPath = join(projectPath, "routemarket_payload.json");
    expect(await fileExists(payloadPath)).toBe(true);
  }, 30000); // 30s timeout
});
