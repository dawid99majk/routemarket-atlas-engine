import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  type MediaManifest, 
  type RouteProject,
  type InputManifest,
  type MediaAsset,
  type ProjectRepository
} from "../../atlas-core/src/index.js";

export async function prepareMediaPack(project: RouteProject, repository?: ProjectRepository): Promise<MediaManifest> {
  const now = new Date().toISOString();
  
  const assets: MediaAsset[] = [];

  // 1. Add creator photos from input manifest
  try {
    const inputManifest = repository 
      ? await repository.loadInputManifest(project.id)
      : await readJsonFileFallback<InputManifest>(join(project.folderPath, "input_manifest.json"));

    for (const item of inputManifest.items) {
      if (item.type === "photo") {
        assets.push({
          id: `media_${item.id}`,
          role: "gallery", // Default to gallery
          source: "creator_upload" as any,
          inputId: item.id,
          path: item.path,
          licenseStatus: "creator_owned" as any,
          locationStatus: "unknown" as any,
          approvalStatus: "pending" as any,
          createdAt: item.addedAt
        } as any);
      }
    }
  } catch (err) {
    console.warn("Could not read input manifest for media pack.");
  }

  // 2. Add AI cover prompt as fallback/candidate
  const prompt = `Realistic travel editorial style cover for ${project.title} in ${project.region}, category: ${project.category}.`;
  assets.push({
    id: "media_ai_cover_prompt",
    role: "cover_candidate" as any,
    source: "ai_prompt" as any,
    prompt,
    licenseStatus: "ai_generated" as any,
    approvalStatus: "pending" as any,
    createdAt: now
  } as any);

  const finalAssets = validateAndDeduplicateMedia(assets);

  const manifest: MediaManifest = {
    updatedAt: now,
    assets: finalAssets
  };

  if (repository) {
    await repository.saveArtifact(project.id, "media/manifest", manifest);
  } else {
    const { writeJsonFile } = await import("../../atlas-core/src/index.js");
    await writeJsonFile(join(project.folderPath, "media", "manifest.json"), manifest);
  }
  
  // Update license report
  let report = `# Media License Report\n\n`;
  for (const asset of assets as any) {
    report += `## ${asset.id}\n- Role: ${asset.role}\n- Source: ${asset.source || "unknown"}\n- License: ${asset.licenseStatus}\n\n`;
  }
  
  if (repository) {
    await repository.writeProjectFile(project.id, "media/license_report.md", report);
  } else {
    await writeFile(join(project.folderPath, "media", "license_report.md"), report, "utf8");
  }

  return manifest;
}

function validateAndDeduplicateMedia(assets: MediaAsset[]): MediaAsset[] {
  const seenUrls = new Set<string>();
  const seenPaths = new Set<string>();

  return assets.map(a => {
    // 1. Check for duplicates
    if (a.url && seenUrls.has(a.url)) {
      return { ...a, status: "duplicate" as any };
    }
    if (a.url) seenUrls.add(a.url);

    if (a.path && seenPaths.has(a.path)) {
      return { ...a, status: "duplicate" as any };
    }
    if (a.path) seenPaths.add(a.path);

    // 2. Check for unsupported (mock: example.com)
    if (a.url?.includes("example.com")) {
      return { ...a, status: "unsupported" as any };
    }

    return { ...a, status: "active" as any };
  });
}

async function readJsonFileFallback<T>(path: string): Promise<T> {
  const { readJsonFile } = await import("../../atlas-core/src/index.js");
  return readJsonFile<T>(path);
}
