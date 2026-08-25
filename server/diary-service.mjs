/**
 * The HTTP face of the diary database.
 *
 * Deliberately has no CORS headers. The browser reaches this through the same
 * origin as the app (the front door in scripts/serve-release.mjs in production,
 * Vite's proxy in development), so nothing here needs cross-origin access — and
 * an open CORS policy would let any website KP happens to visit read his diary
 * off the tailnet address. Same-origin only is the safer default and costs
 * nothing, because the app is same-origin anyway.
 *
 * There is no login. Reaching this service at all means being on the tailnet,
 * which is the authentication boundary the whole setup is built on. That does
 * mean anyone on the tailnet can open anyone's profile: it separates diaries,
 * it does not lock them.
 */

import { createServer } from "node:http";
import { openDiaryStore, isValidProfileId, isValidProfileName, isValidLogId, isSupportedPhotoMimeType, MAX_PAYLOAD_BYTES, MAX_PHOTO_BYTES } from "./diary-store.mjs";

export const API_PREFIX = "/api/nourish";
const BODY_LIMIT = MAX_PAYLOAD_BYTES + 64 * 1024;
const PHOTO_BODY_LIMIT = MAX_PHOTO_BYTES + 16 * 1024;

function send(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    // A diary is never cacheable: a stale read is a wrong calorie total.
    "cache-control": "no-store",
  });
  response.end(text);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    // Refuse loudly rather than truncating: half a diary parsed as the whole one
    // would be written back as the whole one, deleting the rest.
    if (size > BODY_LIMIT) throw new Error("body-too-large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBinaryBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("body-too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createDiaryHandler(store) {
  return async function handle(request, response) {
    const url = new URL(request.url, "http://internal");
    if (!url.pathname.startsWith(API_PREFIX)) return false;
    const segments = url.pathname.slice(API_PREFIX.length).split("/").filter(Boolean);
    const method = request.method ?? "GET";

    try {
      if (segments[0] === "health" && method === "GET") {
        send(response, 200, { ok: true, profiles: store.listProfiles().length, database: store.path });
        return true;
      }

      if (segments[0] === "profiles") {
        if (segments.length === 1 && method === "GET") {
          send(response, 200, { profiles: store.listProfiles() });
          return true;
        }
        if (segments.length === 1 && method === "POST") {
          const body = await readJsonBody(request);
          if (!body || !isValidProfileId(body.id) || !isValidProfileName(body.name)) {
            send(response, 400, { error: "A profile needs a short lowercase id and a name." });
            return true;
          }
          send(response, 201, { profile: store.createProfile(body.id, body.name) });
          return true;
        }
        if (segments.length === 2 && method === "PATCH") {
          const body = await readJsonBody(request);
          if (!body || !isValidProfileName(body.name)) {
            send(response, 400, { error: "A profile needs a name." });
            return true;
          }
          const profile = store.renameProfile(segments[1], body.name);
          if (!profile) send(response, 404, { error: "No such profile." });
          else send(response, 200, { profile });
          return true;
        }
        if (segments.length === 2 && method === "DELETE") {
          send(response, store.deleteProfile(segments[1]) ? 200 : 404, { deleted: segments[1] });
          return true;
        }
      }

      if (segments[0] === "diary" && segments[1]) {
        const profileId = segments[1];
        if (!isValidProfileId(profileId)) {
          send(response, 400, { error: "Not a usable profile id." });
          return true;
        }
        if (segments[2] === "history" && method === "GET") {
          if (segments[3]) {
            const entry = store.readHistoryEntry(profileId, Number(segments[3]));
            if (!entry) send(response, 404, { error: "No such saved copy." });
            else send(response, 200, entry);
            return true;
          }
          send(response, 200, { history: store.listHistory(profileId) });
          return true;
        }
        if (segments.length === 2 && method === "GET") {
          if (!store.getProfile(profileId)) {
            send(response, 404, { error: "No such profile." });
            return true;
          }
          // photos rides alongside the diary rather than inside it: it never goes
          // through localStorage or the merge/backup path, only ever this live read.
          send(response, 200, { ...store.readDiary(profileId), photos: store.listPhotos(profileId) });
          return true;
        }

        if (segments[2] === "log" && segments[3] && segments[4] === "photo" && segments.length === 5) {
          const logId = segments[3];
          if (!isValidLogId(logId)) {
            send(response, 400, { error: "Not a usable log id." });
            return true;
          }
          if (method === "PUT") {
            const contentType = (request.headers["content-type"] ?? "").split(";")[0].trim();
            if (!isSupportedPhotoMimeType(contentType)) {
              send(response, 400, { error: "Photos must be JPEG, PNG or WebP." });
              return true;
            }
            let buffer;
            try {
              buffer = await readBinaryBody(request, PHOTO_BODY_LIMIT);
            } catch (error) {
              if (error instanceof Error && error.message === "body-too-large") {
                send(response, 413, { error: "That photo is too large." });
                return true;
              }
              throw error;
            }
            const result = store.savePhoto(profileId, logId, buffer, contentType);
            if (!result.ok) {
              send(response, result.reason === "too-large" ? 413 : 400, { error: result.reason === "too-large" ? "That photo is too large." : "Not a usable photo." });
              return true;
            }
            send(response, 200, { mimeType: result.mimeType, createdAt: result.createdAt });
            return true;
          }
          if (method === "GET") {
            const photo = store.getPhoto(profileId, logId);
            if (!photo) {
              send(response, 404, { error: "No photo for that entry." });
              return true;
            }
            response.writeHead(200, {
              "content-type": photo.mimeType,
              "content-length": photo.buffer.length,
              // Immutable in practice — a replacement is a new upload, not an edit — so this is safe to cache.
              "cache-control": "private, max-age=86400",
            });
            response.end(photo.buffer);
            return true;
          }
          if (method === "DELETE") {
            store.deletePhoto(profileId, logId);
            send(response, 200, { deleted: true });
            return true;
          }
        }
        if (segments.length === 2 && method === "PUT") {
          const body = await readJsonBody(request);
          if (!body || typeof body !== "object" || typeof body.baseRevision !== "number" || !body.state || typeof body.state !== "object") {
            send(response, 400, { error: "Expected a baseRevision and a state." });
            return true;
          }
          const result = store.writeDiary(profileId, body.state, body.baseRevision);
          if (result.ok) {
            send(response, 200, { revision: result.revision, updatedAt: result.updatedAt });
            return true;
          }
          if (result.reason === "conflict") {
            // Not an error: the other device simply got there first. The newer copy
            // goes back with the refusal so the caller can merge instead of guessing.
            send(response, 409, { error: "This diary moved on since you last read it.", revision: result.revision, state: result.state });
            return true;
          }
          if (result.reason === "no-profile") send(response, 404, { error: "No such profile." });
          else send(response, 413, { error: "That diary is too large to store." });
          return true;
        }
      }

      send(response, 404, { error: "No such endpoint." });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === "body-too-large") {
        send(response, 413, { error: "That request was too large." });
        return true;
      }
      if (error instanceof SyntaxError) {
        send(response, 400, { error: "That request was not valid JSON." });
        return true;
      }
      // Never swallow: the log is the only place a storage failure can surface.
      console.error("[nourish-data] request failed:", error);
      send(response, 500, { error: "The diary database could not complete that." });
      return true;
    }
  };
}

/**
 * On a brand new database there is nowhere to write, and a diary that cannot be
 * saved is the worst outcome this app has. One profile is created so the very
 * first log always lands somewhere; it can be renamed, and others added, later.
 */
export function ensureFirstProfile(store, id = "kp", name = "KP") {
  if (store.listProfiles().length === 0) store.createProfile(id, name);
  return store.listProfiles();
}

/**
 * Runs the 30-day photo sweep once immediately, then daily. `unref()`'d so a lone
 * background timer never keeps the test runner (or a graceful shutdown) waiting.
 */
export function schedulePhotoSweep(store, { intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  const sweep = () => {
    const removed = store.sweepExpiredPhotos(30);
    if (removed > 0) console.log(`[nourish-data] removed ${removed} photo${removed === 1 ? "" : "s"} older than 30 days`);
  };
  sweep();
  const timer = setInterval(sweep, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return () => clearInterval(timer);
}

export function startDiaryService({ port = 4319, host = "127.0.0.1", databasePath } = {}) {
  const store = openDiaryStore(databasePath);
  ensureFirstProfile(store);
  schedulePhotoSweep(store);
  const handle = createDiaryHandler(store);
  const server = createServer((request, response) => {
    handle(request, response).then((handled) => {
      if (!handled) send(response, 404, { error: "No such endpoint." });
    }).catch((error) => {
      console.error("[nourish-data] unhandled:", error);
      if (!response.headersSent) send(response, 500, { error: "Unexpected failure." });
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve({ server, store, port, host }));
  });
}
