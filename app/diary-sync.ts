import { mergeSyncedStates, parseSavedNutritionState, stringifySavedNutritionState, type SavedNutritionState } from "./local-nutrition-state";

/**
 * Talking to the diary database on the Mac Mini.
 *
 * The browser copy stays the working copy and the server is the durable one.
 * That order matters: the app has to keep working on a phone in a lift, and a
 * design where logging food waits on a network round trip is a design that
 * loses entries the moment the Mini is asleep. Everything here is therefore
 * best-effort — a failed sync is reported, never fatal, and never blocks a save
 * to local storage.
 */

export const DIARY_API_BASE = "/api/nourish";
export const DEFAULT_PROFILE_ID = "kp";

export type DiaryProfile = { id: string; name: string; createdAt: string };

/**
 * What the screen is allowed to claim about where the diary is.
 *
 * "This browser only" is the honest default. Nothing may say the Mac Mini has a
 * copy until a write to it has actually succeeded.
 */
export type SyncStatus = "unknown" | "local-only" | "syncing" | "synced" | "conflict" | "failed";

export type SyncOutcome = {
  status: SyncStatus;
  /** Set when the merge produced something the caller should adopt and re-save. */
  state?: SavedNutritionState;
  revision?: number;
  detail?: string;
};

const REQUEST_TIMEOUT_MS = 8000;

async function call(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${DIARY_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Null means "no diary database reachable from here", which is a normal state, not a fault. */
export async function fetchProfiles(): Promise<DiaryProfile[] | null> {
  try {
    const response = await call("/profiles");
    if (!response.ok) return null;
    const body = await response.json() as { profiles?: DiaryProfile[] };
    return Array.isArray(body.profiles) ? body.profiles : null;
  } catch {
    return null;
  }
}

export async function createProfile(id: string, name: string): Promise<DiaryProfile | null> {
  try {
    const response = await call("/profiles", { method: "POST", body: JSON.stringify({ id, name }) });
    if (!response.ok) return null;
    return (await response.json() as { profile: DiaryProfile }).profile;
  } catch {
    return null;
  }
}

export async function renameProfile(id: string, name: string): Promise<DiaryProfile | null> {
  try {
    const response = await call(`/profiles/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!response.ok) return null;
    return (await response.json() as { profile: DiaryProfile }).profile;
  } catch {
    return null;
  }
}

export async function deleteProfile(id: string): Promise<boolean> {
  try {
    return (await call(`/profiles/${encodeURIComponent(id)}`, { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}

/**
 * Pull the server's copy and fold it into this device's.
 *
 * The server payload goes through the same parser as stored bytes, because a
 * diary arriving over the network deserves no more trust than one read off disk —
 * it is the same data written by the same app, and a malformed record must be
 * dropped with a count rather than crashing the load.
 */
export async function pullDiary(profileId: string, local: SavedNutritionState): Promise<SyncOutcome> {
  let response: Response;
  try {
    response = await call(`/diary/${encodeURIComponent(profileId)}`);
  } catch {
    return { status: "local-only", detail: "The Mac Mini is not reachable from here." };
  }
  if (response.status === 404) return { status: "local-only", detail: "That profile does not exist on the Mac Mini yet." };
  if (!response.ok) return { status: "failed", detail: `The diary database answered ${response.status}.` };

  const body = await response.json() as { revision: number; state: unknown };
  // Revision 0 with no state is a profile that has never saved: this device's
  // copy is the whole truth, and pushing it up is the right next move.
  if (!body.state) return { status: "synced", state: local, revision: body.revision };
  const remote = parseSavedNutritionState(JSON.stringify(body.state));
  return { status: "synced", state: mergeSyncedStates(local, remote), revision: body.revision };
}

/**
 * Send this device's copy up.
 *
 * A 409 is not an error: another device saved first. The newer copy comes back
 * with the refusal, so it is merged and retried exactly once. Retrying forever
 * against a busy diary would be a livelock, and one retry covers the real case
 * (two devices, occasionally overlapping) without pretending to solve
 * simultaneous editing from a dozen places.
 */
export async function pushDiary(profileId: string, state: SavedNutritionState, baseRevision: number): Promise<SyncOutcome> {
  const send = (payload: SavedNutritionState, revision: number) => call(`/diary/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    // Through the same serialiser storage uses, so unknown fields from a newer
    // build survive the round trip instead of being dropped on the way up.
    body: JSON.stringify({ baseRevision: revision, state: JSON.parse(stringifySavedNutritionState(payload)) }),
  });

  let response: Response;
  try {
    response = await send(state, baseRevision);
  } catch {
    return { status: "local-only", detail: "The Mac Mini is not reachable from here." };
  }

  if (response.ok) {
    const body = await response.json() as { revision: number };
    return { status: "synced", state, revision: body.revision };
  }

  if (response.status === 409) {
    const body = await response.json() as { revision: number; state: unknown };
    const merged = mergeSyncedStates(state, parseSavedNutritionState(JSON.stringify(body.state ?? {})));
    let retry: Response;
    try {
      retry = await send(merged, body.revision);
    } catch {
      return { status: "local-only", state: merged, detail: "The Mac Mini stopped answering mid-sync." };
    }
    if (retry.ok) {
      const retryBody = await retry.json() as { revision: number };
      return { status: "synced", state: merged, revision: retryBody.revision };
    }
    // Still contended. The merge is kept anyway — it contains both sides, so the
    // next attempt starts from more, never less.
    return { status: "conflict", state: merged, detail: "Another device is saving at the same time; will try again." };
  }

  if (response.status === 404) return { status: "local-only", detail: "That profile does not exist on the Mac Mini yet." };
  return { status: "failed", detail: `The diary database answered ${response.status}.` };
}

/** Plain-English wording for the screen. Never claims the Mac Mini has a copy unless it does. */
export function describeSyncStatus(status: SyncStatus, profileName?: string): string {
  const who = profileName ? ` for ${profileName}` : "";
  if (status === "synced") return `Saved on the Mac Mini${who} and in this browser`;
  if (status === "syncing") return "Saving to the Mac Mini…";
  if (status === "conflict") return "Another device is saving right now — retrying";
  if (status === "failed") return "Saved in this browser only — the diary database returned an error";
  if (status === "local-only") return "Saved in this browser only — the Mac Mini is not reachable";
  return "Saved in this browser";
}
