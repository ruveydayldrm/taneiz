import fs from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "@taneiz/shared";
import { config } from "./config";

/** storage/ altında güvenli mutlak yol; dizin dışına çıkışı engeller. */
export function storagePath(rel: string) {
  const root = path.resolve(config.storageDir);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Geçersiz dosya yolu");
  return full;
}

export async function writeStored(rel: string, data: Uint8Array) {
  const full = storagePath(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return { path: rel.replace(/\\/g, "/"), sha256: sha256Hex(data) };
}

export async function readStored(rel: string) {
  return new Uint8Array(await fs.readFile(storagePath(rel)));
}

export async function moveStored(from: string, to: string) {
  const dest = storagePath(to);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(storagePath(from), dest);
  return to.replace(/\\/g, "/");
}

export function fileUrl(rel: string) {
  return `/api/files/${rel}`;
}

export function extFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
