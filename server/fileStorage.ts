import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Local-disk file storage for uploaded documents.
 *
 * There's no cloud object storage (S3/GCS) configured in this project, so this
 * writes to an `uploads/` directory at the repo root and serves it via
 * `express.static` (registered in server/_core/index.ts). This is a
 * legitimate MVP approach — no missing credentials to block it — but it does
 * NOT survive a redeploy on most hosting platforms with ephemeral disks, and
 * isn't backed up separately from the app. If this ever needs to survive
 * across deploys/scale horizontally, swap this module for an S3/GCS client
 * with the same two functions and nothing else needs to change.
 */

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — generous for scanned forms/photos

/** Strip anything that isn't a safe filename character. */
function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base.slice(-100) : "file";
}

/**
 * Decode a base64 data payload (optionally a `data:<mime>;base64,` URL) and
 * write it under `uploads/<subdir>/`. Returns the public URL path to store as
 * the document's fileUrl, plus the byte size actually written.
 */
export function saveBase64File(subdir: string, fileName: string, base64: string): { url: string; sizeBytes: number } {
  const commaIdx = base64.indexOf(",");
  const raw = base64.startsWith("data:") && commaIdx !== -1 ? base64.slice(commaIdx + 1) : base64;
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length === 0) throw new Error("Empty or invalid file data");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error(`File is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`);

  const dir = path.join(UPLOADS_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${randomUUID()}-${sanitizeFileName(fileName)}`;
  fs.writeFileSync(path.join(dir, safeName), buffer);

  return { url: `/uploads/${subdir}/${safeName}`, sizeBytes: buffer.length };
}

export { UPLOADS_ROOT };
