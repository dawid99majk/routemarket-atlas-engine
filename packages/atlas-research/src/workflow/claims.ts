import { join } from "node:path";
import { 
  readJsonFile, 
  writeJsonFile, 
  type RouteProject, 
  type Claim, 
  type ResearchPack, 
  type RouteSummary,
  type MissingInputs,
  type MissingInputItem
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
      if (material.trustLevel === "creator") {
        const sentences = material.content.split(/[.!?]\s+/);
        for (const sentence of sentences) {
          const cleanSentence = sentence.trim().replace(/^#+\s*[^\r\n]+\s*/g, "").trim();
          if (cleanSentence.length < 40) continue;
          if (isMetaClaim(cleanSentence)) continue;

          const claimType = classifySentence(cleanSentence);
          if (!claimType) continue;

          claims.push({
            id: `claim_creator_h_${Math.random().toString(36).slice(2, 9)}`,
            topicId: project.id,
            claim: cleanSentence,
            claimType: claimType as any,
            confidence: 0.75,
            status: "needs_creator_review",
            sources: [material.id],
            needsHumanReview: true
          });
        }
      }
    }
  } catch {
    // Ignore if no pack
  }

  // 3. Fallback / Quality Gate check
  const contentClaims = claims.filter(c => !c.id.startsWith("claim_tech_"));
  if (contentClaims.length === 0) {
     const missing: MissingInputs = {
      projectId: project.id,
      generatedAt: now,
      blocking: true,
      missing: [{
        code: "insufficient_claims",
        message: "No meaningful claims could be extracted from input materials.",
        requiredFor: "guide_final"
      }]
    };
    await writeJsonFile(join(project.folderPath, "missing_inputs.json"), missing);
  } else {
    // Clear missing inputs if fixed
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(join(project.folderPath, "missing_inputs.json"));
    } catch {}
  }

  await writeJsonFile(claimsPath, claims);
  return claims;
}

function isMetaClaim(sentence: string): boolean {
  const low = sentence.toLowerCase();
  return /\b(source|article|blog|website|page|video|material|document)\b/.test(low)
    && /\b(contains|provides|describes|mentions|explains|lists|includes|covers)\b/.test(low);
}

function classifySentence(s: string): string | undefined {
  const low = s.toLowerCase();
  if (/\b(water|fuel|food|parking|ferry|border|hotel|campsite)\b/.test(low)) return "logistics";
  if (/\b(danger|risk|avalanche|flood|closed|police|theft|exposed)\b/.test(low)) return "safety";
  if (/\b(asphalt|gravel|offroad|paved|mud|sand)\b/.test(low)) return "surface";
  if (/\b(season|snow|winter|summer|rain|heat)\b/.test(low)) return "season";
  if (/\b(permit|legal|allowed|forbidden|access)\b/.test(low)) return "access";
  if (/\b(km|kilometers|distance|elevation|climb)\b/.test(low)) return "distance";
  return undefined;
}

async function readExistingNonGeneratedClaims(project: RouteProject): Promise<Claim[]> {
  try {
    const existing = await readJsonFile<Claim[]>(join(project.folderPath, "claims.json"));
    // Filter out old placeholder claims
    return existing.filter((claim) => 
      !claim.claim.includes("may contain useful route intelligence") &&
      !claim.claim.includes("provides authoritative details") &&
      !claim.id.startsWith("claim_tech_") &&
      !claim.id.startsWith("claim_missing_") &&
      !claim.id.startsWith("claim_creator_h_")
    );
  } catch {
    return [];
  }
}
