import { join } from "node:path";

export function dataPath(rootDir: string, ...segments: string[]): string {
  return join(rootDir, "data", ...segments);
}

export function routesPath(rootDir: string, ...segments: string[]): string {
  return join(rootDir, "routes", ...segments);
}
