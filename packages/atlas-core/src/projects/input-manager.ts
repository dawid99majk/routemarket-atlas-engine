import { mkdir, readFile, writeFile, stat, copyFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { readJsonFile, writeJsonFile } from "../storage/json.js";
import type { InputManifest, InputItem, InputItemType, InputItemStatus } from "../models/input-manifest.js";
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

export async function addInputText(folderPath: string, input: {
  fileName: string;
  content: string;
  type: "note" | "gpx";
  note?: string;
}): Promise<InputItem> {
  const fileName = sanitizeInputFileName(input.fileName, input.type === "gpx" ? [".gpx"] : [".md", ".txt"]);
  const maxSize = input.type === "gpx" ? 10_000_000 : 1_000_000;
  const sizeBytes = Buffer.byteLength(input.content, "utf8");
  if (sizeBytes > maxSize) throw new Error(`Input is too large. Max size is ${maxSize} bytes.`);

  const manifest = await loadInputManifest(folderPath);
  const now = new Date().toISOString();
  const targetSubDir = join("input", input.type === "gpx" ? "gpx" : "notes");
  await mkdir(join(folderPath, targetSubDir), { recursive: true });
  const targetPath = join(targetSubDir, fileName);
  await writeFile(join(folderPath, targetPath), input.content, "utf8");

  const item: InputItem = {
    id: `${input.type}_${Date.now()}`,
    type: input.type,
    path: targetPath,
    originalName: fileName,
    mimeType: getMimeType(fileName),
    sizeBytes,
    addedAt: now,
    status: "added",
    notes: input.note
  };

  manifest.items.push(item);
  manifest.updatedAt = now;
  await saveInputManifest(folderPath, manifest);
  return item;
}

export async function registerExternalInput(folderPath: string, input: {
  type: InputItemType;
  originalName: string;
  storageUrl?: string;
  storageKey?: string;
  mimeType: string;
  sizeBytes: number;
  note?: string;
}): Promise<InputItem> {
  if (!input.storageUrl && !input.storageKey) throw new Error("storageUrl or storageKey is required.");
  const manifest = await loadInputManifest(folderPath);
  const now = new Date().toISOString();
  const fileName = basename(input.originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const item: InputItem = {
    id: `${input.type}_${Date.now()}`,
    type: input.type,
    path: input.storageKey ?? input.storageUrl ?? fileName,
    originalName: fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageUrl: input.storageUrl,
    storageKey: input.storageKey,
    addedAt: now,
    status: externalStatus(input.type, fileName, input.mimeType),
    notes: input.note
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
  await mkdir(join(folderPath, targetSubDir), { recursive: true });
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

function externalStatus(type: InputItemType, fileName: string, mimeType: string): InputItemStatus {
  const ext = extname(fileName).toLowerCase();
  if (type === "note" && [".md", ".txt"].includes(ext)) return "needs_parser";
  if (type === "gpx" && ext === ".gpx") return "needs_parser";
  if (type === "photo" && mimeType.startsWith("image/")) return "needs_review";
  if (type === "document" && [".pdf", ".docx"].includes(ext)) return "needs_parser";
  return "unsupported";
}

export function sanitizeInputFileName(fileName: string, allowedExtensions: string[]): string {
  const base = basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base || base === "." || base === "..") throw new Error("Invalid filename.");
  if (base !== fileName || fileName.includes("/") || fileName.includes("\\")) throw new Error("Invalid filename.");
  const ext = extname(base).toLowerCase();
  if (!allowedExtensions.includes(ext)) throw new Error(`Invalid file extension: ${ext || "(none)"}.`);
  return base;
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
