import { invoke } from "@tauri-apps/api/core";

/**
 * App-managed cover images for timeline records. Files live under
 * `<app data dir>/timeline-assets/<recordId>/cover.<ext>`; records only keep
 * the relative ref. The user's original file is never modified.
 *
 * Display goes through the `timeline_read_cover` command (base64 data URL) —
 * no asset protocol required, and read failures become a placeholder instead
 * of a crash.
 */

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Whitelist kept in sync with the Rust side. */
export function isSupportedImageMime(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "";
}

/** Copy a picked image into app storage. Returns the relative ref. */
export async function saveCover(
  recordId: string,
  dataBase64: string,
  ext: string,
): Promise<string> {
  return await invoke<string>("timeline_save_cover", {
    recordId,
    ext,
    dataBase64,
  });
}

/** Read a cover as a data URL ("data:image/png;base64,…") for <img> src. */
export async function readCoverDataUrl(coverRef: string): Promise<string | null> {
  try {
    return await invoke<string>("timeline_read_cover", { coverRef });
  } catch {
    return null;
  }
}

/** Delete a single cover file by ref (idempotent). */
export async function deleteCover(coverRef: string): Promise<void> {
  await invoke("timeline_delete_cover", { coverRef });
}

/** Delete all assets of a record — called when the record is removed. */
export async function deleteRecordAssets(recordId: string): Promise<void> {
  await invoke("timeline_delete_record_assets", { recordId });
}

// Data URLs for already-loaded covers, so thumbnails don't re-fetch on rerender.
const dataUrlCache = new Map<string, string>();

/** Cached variant of {@link readCoverDataUrl} for list rendering. */
export async function coverDataUrl(coverRef: string): Promise<string | null> {
  const cached = dataUrlCache.get(coverRef);
  if (cached !== undefined) return cached;
  const url = await readCoverDataUrl(coverRef);
  if (url !== null) dataUrlCache.set(coverRef, url);
  return url;
}

export function dropCoverCache(coverRef: string): void {
  dataUrlCache.delete(coverRef);
}
