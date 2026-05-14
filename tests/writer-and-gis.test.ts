import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRouteProject } from "../packages/atlas-core/src/index.js";
import { validateGeoJson, validateGpxXml } from "../packages/atlas-gis/src/index.js";
import { generateGuideDraft, generateQualityReport, generateRouteConcept } from "../packages/atlas-writer/src/index.js";

let tempRoots: string[] = [];

describe("writer and GIS helpers", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots = [];
  });

  it("generates concept, guide, and quality report", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atlas-writer-"));
    tempRoots.push(rootDir);
    const project = await createRouteProject({
      rootDir,
      title: "Albania motorcycle route 7 days",
      category: "motorcycle",
      region: "Albania",
      language: "en"
    });

    const concept = await generateRouteConcept({ project, sources: [] });
    const guide = await generateGuideDraft({ project, sources: [], concept });
    const quality = await generateQualityReport({ project, sources: [], gpxValid: false, geojsonValid: true });

    expect(concept).toContain("Route promise");
    expect(guide).toContain("Route overview");
    expect(quality).toContain("Source coverage");
  });

  it("validates GPX and GeoJSON basics", () => {
    const gpx = validateGpxXml('<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="1" lon="2"></trkpt></trkseg></trk></gpx>');
    const geojson = validateGeoJson({ type: "FeatureCollection", features: [] });

    expect(gpx.valid).toBe(true);
    expect(gpx.trackPointCount).toBe(1);
    expect(geojson.valid).toBe(true);
  });
});
