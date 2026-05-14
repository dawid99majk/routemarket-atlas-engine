import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MediaManifest, RouteProject } from "../../atlas-core/src/index.js";
import { writeJsonFile } from "../../atlas-core/src/index.js";

export async function prepareMediaPack(project: RouteProject): Promise<MediaManifest> {
  const now = new Date().toISOString();
  const prompt = `Original RouteMarket cover image for ${project.title} in ${project.region}. Realistic travel editorial style, no text, no logos, not copying any specific photograph.`;
  const manifest: MediaManifest = {
    updatedAt: now,
    assets: [
      {
        id: "media_001",
        role: "cover",
        prompt,
        licenseStatus: "ai_generated",
        notes: "Prompt prepared for RouteMarket MCP generate_image. Asset not generated yet.",
        createdAt: now
      }
    ]
  };

  await writeJsonFile(join(project.folderPath, "media", "manifest.json"), manifest);
  await writeFile(
    join(project.folderPath, "media", "license_report.md"),
    `# Media License Report\n\n## media_001\n\n- Role: cover\n- Status: AI prompt prepared, image not generated yet\n- License status: ai_generated after generation through RouteMarket MCP\n- Prompt: ${prompt}\n`,
    "utf8"
  );
  return manifest;
}
