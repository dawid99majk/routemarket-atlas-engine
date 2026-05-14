import { readFile } from "node:fs/promises";

export type GpxValidationResult = {
  valid: boolean;
  errors: string[];
  trackPointCount: number;
};

export async function validateGpxFile(path: string): Promise<GpxValidationResult> {
  const xml = await readFile(path, "utf8");
  return validateGpxXml(xml);
}

export function validateGpxXml(xml: string): GpxValidationResult {
  const errors: string[] = [];
  if (!xml.includes("<gpx")) errors.push("Missing <gpx> root element.");
  if (!xml.includes("</gpx>")) errors.push("Missing closing </gpx> element.");
  const trackPointCount = (xml.match(/<trkpt\b/g) ?? []).length;
  const routePointCount = (xml.match(/<rtept\b/g) ?? []).length;
  if (trackPointCount + routePointCount === 0) errors.push("No track or route points found.");
  return {
    valid: errors.length === 0,
    errors,
    trackPointCount: trackPointCount + routePointCount
  };
}
