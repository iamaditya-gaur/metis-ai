import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeTextFile(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${content.trimEnd()}\n`, "utf8");
}

export async function writeJsonFile(targetPath, value) {
  await writeTextFile(targetPath, JSON.stringify(value, null, 2));
}

export async function appendJsonLine(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await appendFile(targetPath, `${JSON.stringify(value)}\n`, "utf8");
}

export function isoNow() {
  return new Date().toISOString();
}

export function todayDate() {
  return isoNow().slice(0, 10);
}
