// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

/** Whether the storage proxy is configured (creds present). */
export function hasStorageConfigured(): boolean {
  return !!(ENV.forgeApiUrl && ENV.forgeApiKey);
}

/**
 * Persist a base64 media data URL and return a storable URL + its type.
 * - Storage configured → uploads the bytes to the proxy, returns a small URL.
 * - Not configured (dev) → returns the image data URL unchanged (fallback);
 *   video is rejected because it's too large to inline in the database.
 */
export async function persistMediaDataUrl(dataUrl: string): Promise<{ url: string; mediaType: "image" | "video" }> {
  const m = /^data:(image|video)\/([a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Unsupported media format.");
  const kind = m[1] as "image" | "video";
  const subtype = m[2];
  const b64 = m[3];

  if (!hasStorageConfigured()) {
    if (kind === "video") {
      throw new Error("Video uploads require the storage proxy (set BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY).");
    }
    return { url: dataUrl, mediaType: "image" };
  }

  const buffer = Buffer.from(b64, "base64");
  const ext = subtype === "jpeg" ? "jpg" : subtype === "quicktime" ? "mov" : subtype;
  const key = `activity-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { url } = await storagePut(key, buffer, `${kind}/${subtype}`);
  return { url, mediaType: kind };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
