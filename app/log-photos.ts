import { DIARY_API_BASE } from "./diary-sync";

/**
 * Photos for a logged entry live only on the diary database, never in the
 * synced JSON diary or browser storage — see app/diary-sync.ts's `pullDiary`
 * for how their presence is learned. A failed upload must never block or
 * revert the food log it was attached to, so every call here is best-effort
 * and reports failure rather than throwing.
 */

export type LogPhotoMeta = { mimeType: string; createdAt: string };

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedPhotoFile(file: File) {
  return SUPPORTED_TYPES.has(file.type);
}

function photoPath(profileId: string, logId: string) {
  return `${DIARY_API_BASE}/diary/${encodeURIComponent(profileId)}/log/${encodeURIComponent(logId)}/photo`;
}

export function photoUrl(profileId: string, logId: string) {
  return photoPath(profileId, logId);
}

export async function uploadLogPhoto(profileId: string, logId: string, file: File): Promise<{ ok: true; meta: LogPhotoMeta } | { ok: false; reason: string }> {
  if (!isSupportedPhotoFile(file)) return { ok: false, reason: "Photos must be JPEG, PNG or WebP." };
  try {
    const response = await fetch(photoPath(profileId, logId), {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      return { ok: false, reason: body?.error ?? `The diary database answered ${response.status}.` };
    }
    const meta = await response.json() as LogPhotoMeta;
    return { ok: true, meta };
  } catch {
    return { ok: false, reason: "The Mac Mini is not reachable from here." };
  }
}

export async function deleteLogPhoto(profileId: string, logId: string): Promise<boolean> {
  try {
    return (await fetch(photoPath(profileId, logId), { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}
