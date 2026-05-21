import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ZodSchema } from "zod";

export async function writeTextFileAtomic(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmpPath = join(dir, `.tmp.${randomUUID()}.~atomic`);
  await writeFile(tmpPath, content, "utf8");
  
  let retries = 5;
  while (retries > 0) {
    try {
      await rename(tmpPath, path);
      return;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeTextFileAtomic(path, content);
}

export async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

export async function readJsonFileWithSchema<T>(path: string, schema: ZodSchema<T>): Promise<T> {
  const data = await readJsonFile<unknown>(path);
  return schema.parse(data);
}
export async function exists(path: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
