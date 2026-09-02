import { DIARY_API_BASE } from "./diary-api";

/**
 * Photos for a logged entry live only on the diary database, never in the
 * synced JSON diary or browser storage — see app/diary-sync.ts's `pullDiary`
 * for how their presence is learned. A failed upload must never block or
 * revert the food log it was attached to, so every call here is best-effort
 * and reports failure rather than throwing.
 */

export type LogPhotoMeta = { mimeType: string; createdAt: string };

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FOOD_PHOTO_URL_PATTERN = new RegExp(`^${DIARY_API_BASE}/diary/[a-z0-9][a-z0-9-]{0,30}/food/([A-Za-z0-9_-]{1,64})/photo(?:[?#].*)?$`);
const BUNDLED_FOOD_PHOTO_PATTERN = /^\/food-images\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i;

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

/**
 * A photo of a food in KP's own catalogue. Same transport as a log photo, but a
 * different endpoint on purpose: these are never swept after 30 days, because
 * the picture identifies the item rather than recording one meal.
 */
function foodPhotoPath(profileId: string, foodId: string) {
  return `${DIARY_API_BASE}/diary/${encodeURIComponent(profileId)}/food/${encodeURIComponent(foodId)}/photo`;
}

/** The value stored as a food's `imageUrl`, so every existing thumbnail just works. */
export function foodPhotoUrl(profileId: string, foodId: string) {
  return foodPhotoPath(profileId, foodId);
}

/**
 * The key encoded in an existing food-photo URL. Cache-busters and fragments
 * are presentation details, never a reason to lose the durable identifier.
 */
export function foodPhotoKeyFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.match(FOOD_PHOTO_URL_PATTERN)?.[1] ?? null;
}

/** Only this app's precise food-photo route may be managed as a stored photo. */
export function isFoodPhotoUrl(value: string | undefined) {
  return foodPhotoKeyFromUrl(value) !== null;
}

/**
 * Catalogue cards render during startup, including when the Mac Mini has no
 * internet connection. Only bundled images and photos stored by Nourish may
 * auto-load there; hot-linked retailer images would make an offline screen
 * wait on dozens of third-party hosts.
 */
export function isAutoLoadedFoodImage(value: string | undefined) {
  return Boolean(value && (BUNDLED_FOOD_PHOTO_PATTERN.test(value) || isFoodPhotoUrl(value)));
}

export async function uploadFoodPhoto(profileId: string, foodId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!isSupportedPhotoFile(file)) return { ok: false, reason: "Photos must be JPEG, PNG or WebP." };
  try {
    const response = await fetch(foodPhotoPath(profileId, foodId), {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      return { ok: false, reason: body?.error ?? `The diary database answered ${response.status}.` };
    }
    return { ok: true, url: foodPhotoUrl(profileId, foodId) };
  } catch {
    return { ok: false, reason: "The Mac Mini is not reachable from here." };
  }
}

export async function deleteFoodPhoto(profileId: string, foodId: string): Promise<boolean> {
  try {
    return (await fetch(foodPhotoPath(profileId, foodId), { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}
