import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RouteProject } from "../models/route-project.js";
import { RouteProjectSchema } from "../models/route-project.js";
import { routesPath } from "../storage/paths.js";
import { writeJsonFile } from "../storage/json.js";
import { slugify } from "./slug.js";

import { ProjectAlreadyExistsError } from "../errors.js";

export type CreateRouteProjectInput = {
  rootDir: string;
  title: string;
  category?: string;
  region?: string;
  language?: string;
  topicId?: string;
};

export async function createRouteProject(input: CreateRouteProjectInput): Promise<RouteProject> {
  const now = new Date().toISOString();
  const slug = slugify(input.title);
  const folderPath = routesPath(input.rootDir, slug);
  const projectJsonPath = join(folderPath, "project.json");

  try {
    await stat(projectJsonPath);
    throw new ProjectAlreadyExistsError(slug);
  } catch (err: any) {
    if (err.name === "ProjectAlreadyExistsError") throw err;
    if (err.code !== "ENOENT") throw err;
  }

  const project = RouteProjectSchema.parse({
    id: slug,
    topicId: input.topicId,
    title: input.title,
    slug,
    category: input.category ?? inferCategory(input.title),
    region: input.region ?? "unknown",
    language: input.language ?? "en",
    status: "research_needed",
    folderPath,
    createdAt: now,
    updatedAt: now
  });

  await mkdir(join(folderPath, "media"), { recursive: true });
  await mkdir(join(folderPath, "input", "notes"), { recursive: true });
  await mkdir(join(folderPath, "input", "docs"), { recursive: true });
  await mkdir(join(folderPath, "input", "photos"), { recursive: true });
  await mkdir(join(folderPath, "input", "gpx"), { recursive: true });
  await mkdir(join(folderPath, "input", "links"), { recursive: true });

  await writeJsonFile(join(folderPath, "project.json"), project);
  await writeJsonFile(join(folderPath, "input_manifest.json"), {
    projectId: project.id,
    updatedAt: now,
    items: []
  });
  await writeJsonFile(join(folderPath, "creator_answers.json"), {
    projectId: project.id,
    updatedAt: now,
    answers: []
  });
  await writeJsonFile(join(folderPath, "approvals.json"), {
    projectId: project.id,
    updatedAt: now,
    approvals: []
  });

  await writeFile(join(folderPath, "brief.md"), starterBrief(project), "utf8");
  await writeJsonFile(join(folderPath, "sources.json"), []);
  await writeJsonFile(join(folderPath, "tips.json"), []);
  await writeJsonFile(join(folderPath, "recommendations.json"), []);
  await writeJsonFile(join(folderPath, "route_summary.json"), {
    riskLevel: "unknown",
    validationStatus: "needs_validation",
    updatedAt: now
  });
  await writeJsonFile(join(folderPath, "media", "manifest.json"), { assets: [], updatedAt: now });
  await writeFile(join(folderPath, "notes.md"), starterNotes(project), "utf8");
  await writeJsonFile(join(folderPath, "claims.json"), []);
  await writeFile(join(folderPath, "poi.geojson"), starterPoiGeoJson(), "utf8");
  await writeFile(join(folderPath, "route_concept.md"), starterRouteConcept(project), "utf8");
  await writeFile(join(folderPath, "quality_report.md"), starterQualityReport(), "utf8");
  await writeFile(join(folderPath, "review_checklist.md"), starterReviewChecklist(), "utf8");
  await writeFile(join(folderPath, "media", "license_report.md"), "# Media License Report\n\nNo media assets yet.\n", "utf8");

  return project;
}

function inferCategory(title: string): string {
  const lowered = title.toLowerCase();
  if (lowered.includes("motorcycle") || lowered.includes("motocykl")) return "motorcycle";
  if (lowered.includes("cycling") || lowered.includes("bike") || lowered.includes("rower")) return "cycling";
  if (lowered.includes("running") || lowered.includes("run")) return "running";
  if (lowered.includes("city") || lowered.includes("walking") || lowered.includes("walk")) return "city_walk";
  if (lowered.includes("roadtrip") || lowered.includes("drive") || lowered.includes("car")) return "roadtrip";
  return "hiking";
}

function starterBrief(project: RouteProject): string {
  return `# Research brief\n\nTopic: ${project.title}\nCategory: ${project.category}\nRegion: ${project.region}\nLanguage: ${project.language}\n\nStatus: needs research\n`;
}

function starterNotes(project: RouteProject): string {
  return `# Notes\n\nWorking notes for ${project.title}.\n\n## Source collection\n\nNo sources collected yet.\n`;
}

function starterPoiGeoJson(): string {
  return `${JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2)}\n`;
}

function starterRouteConcept(project: RouteProject): string {
  return `# Route Concept\n\nTopic: ${project.title}\n\nConcept status: not designed yet.\n`;
}

function starterQualityReport(): string {
  return `# Quality Report\n\n## Source coverage\n\nNot collected yet.\n\n## GPX validation\n\nNot available in MVP 1.\n\n## Human review points\n\n- Confirm source coverage.\n- Confirm safety notes.\n- Confirm legal/media status.\n`;
}

function starterReviewChecklist(): string {
  return `# Review Checklist\n\n- [ ] Sources collected\n- [ ] Claims verified\n- [ ] Route concept reviewed\n- [ ] GPX validated\n- [ ] Guide reviewed\n- [ ] Media/legal status checked\n- [ ] RouteMarket payload prepared\n`;
}
