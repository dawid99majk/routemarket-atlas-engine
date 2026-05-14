import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { 
  readJsonFile, 
  writeJsonFile, 
  type RouteProject, 
  type ResearchPack, 
  type ResearchMaterial,
  type InputManifest,
  type Source,
  type ResearchTrustLevel
} from "../../../atlas-core/src/index.js";

export async function buildResearchPack(project: RouteProject): Promise<ResearchPack> {
  const now = new Date().toISOString();
  const manifestPath = join(project.folderPath, "input_manifest.json");
  const sourcesPath = join(project.folderPath, "sources.json");
  const researchPackPath = join(project.folderPath, "research_pack.json");

  const manifest = await readJsonFile<InputManifest>(manifestPath);
  const webSources = await readJsonFile<Source[]>(sourcesPath);

  const materials: ResearchMaterial[] = [];

  // 1. Process creator inputs from manifest
  for (const item of manifest.items) {
    if (item.status === "ignored") continue;

    if (item.type === "note" || item.type === "document") {
      try {
        const content = await readFile(join(project.folderPath, item.path), "utf8");
        materials.push({
          id: `mat_${item.id}`,
          inputId: item.id,
          type: item.type,
          title: item.originalName,
          content,
          trustLevel: "creator",
          status: "usable"
        });
      } catch (err) {
        console.warn(`Could not read input file: ${item.path}`);
      }
    } else if (item.type === "link") {
      materials.push({
        id: `mat_${item.id}`,
        inputId: item.id,
        type: "link",
        title: item.originalName,
        content: `Link to external resource: ${item.path}`,
        sourceUrl: item.path,
        trustLevel: "unknown",
        status: "usable"
      });
    }
  }

  // 2. Process web sources
  for (const source of webSources) {
    materials.push({
      id: `mat_${source.id}`,
      type: "source",
      title: source.title,
      content: source.contentSummary,
      sourceUrl: source.url,
      trustLevel: inferTrustLevel(source.sourceType),
      status: source.relevanceScore > 40 ? "usable" : "weak"
    });
  }

  // 3. Process deep research if exists
  const deepResearchPath = join(project.folderPath, "deep_research.json");
  try {
    const deepResearch = await readJsonFile<any>(deepResearchPath);
    if (deepResearch && Array.isArray(deepResearch.claims)) {
      materials.push({
        id: `mat_deep_research`,
        type: "deep_research",
        title: "Deep Research Extraction",
        content: deepResearch.claims.map((c: any) => c.claim).join("\n"),
        trustLevel: "community",
        status: "usable"
      });
    }
  } catch {
    // Ignore if no deep research
  }

  const pack: ResearchPack = {
    projectId: project.id,
    topic: project.title,
    category: project.category,
    region: project.region,
    language: project.language,
    updatedAt: now,
    materials
  };

  await writeJsonFile(researchPackPath, pack);
  return pack;
}

function inferTrustLevel(sourceType: string): ResearchTrustLevel {
  switch (sourceType) {
    case "official": return "official";
    case "map": return "map";
    case "blog":
    case "youtube":
    case "reddit":
    case "forum": return "community";
    default: return "unknown";
  }
}
