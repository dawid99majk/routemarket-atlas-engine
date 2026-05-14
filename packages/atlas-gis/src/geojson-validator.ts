import { readFile } from "node:fs/promises";

export type GeoJsonValidationResult = {
  valid: boolean;
  errors: string[];
  featureCount: number;
};

export async function validateGeoJsonFile(path: string): Promise<GeoJsonValidationResult> {
  const raw = await readFile(path, "utf8");
  return validateGeoJson(JSON.parse(raw) as unknown);
}

export function validateGeoJson(value: unknown): GeoJsonValidationResult {
  const errors: string[] = [];
  const obj = value as { type?: unknown; features?: unknown };
  if (!obj || typeof obj !== "object") errors.push("GeoJSON is not an object.");
  if (obj.type !== "FeatureCollection") errors.push("GeoJSON type must be FeatureCollection.");
  if (!Array.isArray(obj.features)) errors.push("GeoJSON features must be an array.");
  return {
    valid: errors.length === 0,
    errors,
    featureCount: Array.isArray(obj.features) ? obj.features.length : 0
  };
}
