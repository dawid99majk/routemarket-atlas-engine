import { join } from "node:path";
import type { Claim, RouteProject, Source } from "../../../atlas-core/src/index.js";
import { readJsonFile, writeJsonFile } from "../../../atlas-core/src/index.js";

export async function generateClaims(project: RouteProject, sources: Source[]): Promise<Claim[]> {
  const preservedClaims = await readExistingNonGeneratedClaims(project);
  const claims: Claim[] = [...preservedClaims];
  sources.slice(0, 6).forEach((source, index) => {
    claims.push({
      id: `claim_${String(preservedClaims.length + index + 1).padStart(3, "0")}`,
      topicId: project.id,
      claim: `${source.title} may contain useful route intelligence for ${project.title}.`,
      claimType: source.sourceType === "official" ? "logistics" : "route_segment",
      confidence: source.trustScore >= 75 ? 0.65 : 0.45,
      status: "uncertain",
      sources: [source.id],
      needsHumanReview: false
    });
  });

  await writeJsonFile(join(project.folderPath, "claims.json"), claims);
  return claims;
}

async function readExistingNonGeneratedClaims(project: RouteProject): Promise<Claim[]> {
  try {
    const existing = await readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
    return existing.filter((claim) => !claim.claim.includes("may contain useful route intelligence"));
  } catch {
    return [];
  }
}
