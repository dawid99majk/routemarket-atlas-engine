import { join } from "node:path";
import { 
  readJsonFile, 
  writeJsonFile, 
  type RouteProject, 
  type Claim, 
  type ResearchPack, 
  type RouteSummary 
} from "../../../atlas-core/src/index.js";

export async function generateClaims(project: RouteProject): Promise<Claim[]> {
  const now = new Date().toISOString();
  const researchPackPath = join(project.folderPath, "research_pack.json");
  const routeSummaryPath = join(project.folderPath, "route_summary.json");
  const claimsPath = join(project.folderPath, "claims.json");

  const preservedClaims = await readExistingNonGeneratedClaims(project);
  const claims: Claim[] = [...preservedClaims];

  // 1. Generate technical claims from GPX summary
  try {
    const summary = await readJsonFile<RouteSummary>(routeSummaryPath);
    if (summary.distanceKm && summary.distanceKm > 0) {
      claims.push({
        id: `claim_tech_dist_${Date.now()}`,
        topicId: project.id,
        claim: `The total distance of the route is approximately ${summary.distanceKm} km.`,
        claimType: "distance",
        confidence: 0.95,
        status: "verified",
        sources: ["route_summary.json"],
        needsHumanReview: false
      });
      claims.push({
        id: `claim_tech_ele_${Date.now()}`,
        topicId: project.id,
        claim: `The total elevation gain is ${summary.elevationGainM} m.`,
        claimType: "difficulty",
        confidence: 0.9,
        status: "verified",
        sources: ["route_summary.json"],
        needsHumanReview: false
      });
      claims.push({
        id: `claim_tech_loop_${Date.now()}`,
        topicId: project.id,
        claim: `This is a ${summary.loopType === "loop" ? "loop" : "point-to-point"} route.`,
        claimType: "route_segment",
        confidence: 0.95,
        status: "verified",
        sources: ["route_summary.json"],
        needsHumanReview: false
      });
    }
  } catch {
    // Ignore if no summary
  }

  // 2. Generate content claims from Research Pack
  try {
    const pack = await readJsonFile<ResearchPack>(researchPackPath);
    for (const material of pack.materials) {
      if (material.type === "deep_research" || material.trustLevel === "creator") {
        // Here we would normally use an LLM to extract real facts.
        // For MVP, we'll extract some "potential" facts or keep it simple.
        // If it's a creator note, it's a high confidence fact.
        if (material.trustLevel === "creator") {
           claims.push({
            id: `claim_creator_${material.id}_${Date.now()}`,
            topicId: project.id,
            claim: `Creator note: ${material.title} provides authoritative details about the route.`,
            claimType: "logistics",
            confidence: 1.0,
            status: "verified",
            sources: [material.id],
            needsHumanReview: false
          });
        }
      }
    }
  } catch {
    // Ignore if no pack
  }

  // 3. Fallback / Quality Gate check
  if (claims.length === 0) {
    claims.push({
      id: `claim_missing_${Date.now()}`,
      topicId: project.id,
      claim: "Missing input materials to generate meaningful route claims.",
      claimType: "legal",
      confidence: 1.0,
      status: "needs_creator_review",
      sources: [],
      needsHumanReview: true
    });
  }

  await writeJsonFile(claimsPath, claims);
  return claims;
}

async function readExistingNonGeneratedClaims(project: RouteProject): Promise<Claim[]> {
  try {
    const existing = await readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
    // Filter out old placeholder claims
    return existing.filter((claim) => 
      !claim.claim.includes("may contain useful route intelligence") &&
      !claim.id.startsWith("claim_tech_") &&
      !claim.id.startsWith("claim_missing_")
    );
  } catch {
    return [];
  }
}
