import { readFile, writeFile, stat, copyFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { readJsonFile, writeJsonFile } from "../storage/json.js";
import type { InputManifest, InputItem, InputItemType } from "../models/input-manifest.js";
import { InputManifestSchema } from "../models/input-manifest.js";

export async function loadInputManifest(folderPath: string): Promise<InputManifest> {
  const path = join(folderPath, "input_manifest.json");
  const data = await readJsonFile<unknown>(path);
  return InputManifestSchema.parse(data);
}

export async function saveInputManifest(folderPath: string, manifest: InputManifest): Promise<void> {
  const path = join(folderPath, "input_manifest.json");
  await writeJsonFile(path, manifest);
}

export async function addInputLink(folderPath: string, url: string, note?: string): Promise<InputItem> {
  const manifest = await loadInputManifest(folderPath);
  const id = `link_${Date.now()}`;
  const now = new Date().toISOString();
  
  const item: InputItem = {
    id,
    type: "link",
    path: url,
    originalName: url,
    mimeType: "text/uri-list",
    sizeBytes: 0,
    addedAt: now,
    status: "added",
    notes: note
  };

  manifest.items.push(item);
  manifest.updatedAt = now;
  await saveInputManifest(folderPath, manifest);
  return item;
}

export async function addInputFile(folderPath: string, sourcePath: string, type: InputItemType, note?: string): Promise<InputItem> {
  const manifest = await loadInputManifest(folderPath);
  const now = new Date().toISOString();
  const fileName = basename(sourcePath);
  const targetSubDir = join("input", type === "note" ? "notes" : type === "photo" ? "photos" : type === "gpx" ? "gpx" : "docs");
  const targetPath = join(targetSubDir, fileName);
  const absoluteTargetPath = join(folderPath, targetPath);

  // Copy file
  await copyFile(sourcePath, absoluteTargetPath);
  const fileStat = await stat(absoluteTargetPath);

  const item: InputItem = {
    id: `${type}_${Date.now()}`,
    type,
    path: targetPath,
    originalName: fileName,
    mimeType: getMimeType(fileName),
    sizeBytes: fileStat.size,
    addedAt: now,
    status: "added",
    notes: note
  };

  manifest.items.push(item);
  manifest.updatedAt = now;
  await saveInputManifest(folderPath, manifest);
  return item;
}

function getMimeType(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  switch (ext) {
    case ".md": return "text/markdown";
    case ".txt": return "text/plain";
    case ".gpx": return "application/gpx+xml";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
}
