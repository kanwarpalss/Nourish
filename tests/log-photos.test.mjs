import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Readable } from "node:stream";
import { createDiaryHandler, ensureFirstProfile, API_PREFIX } from "../server/diary-service.mjs";
import { openDiaryStore, MAX_PHOTO_BYTES } from "../server/diary-store.mjs";

/**
 * Photos are the one part of the diary that never rides through the JSON payload —
 * they are their own table, their own files on disk, and their own routes. These
 * tests drive the real HTTP handler and the real store against a real temporary
 * SQLite file, exactly like diary-service.test.mjs, so nothing about routing,
 * storage or the 30-day sweep is mocked.
 */
function fakeRequest(method, endpoint, body, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  request.url = `${API_PREFIX}${endpoint}`;
  request.headers = headers;
  return request;
}

function fakeResponse() {
  return {
    status: 0,
    text: "",
    buffer: null,
    headers: {},
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    end(payload) {
      if (Buffer.isBuffer(payload)) this.buffer = payload;
      else this.text = payload ?? "";
    },
  };
}

async function withService(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nourish-photo-test-"));
  const databasePath = path.join(directory, "diary.db");
  const store = openDiaryStore(databasePath);
  ensureFirstProfile(store);
  const handle = createDiaryHandler(store);
  const call = async (method, endpoint, body, headers) => {
    const response = fakeResponse();
    const handled = await handle(fakeRequest(method, endpoint, body, headers), response);
    assert.ok(handled, `${method} ${endpoint} was not routed at all`);
    return { status: response.status, headers: response.headers, body: response.text ? JSON.parse(response.text) : null, buffer: response.buffer };
  };
  try {
    await run({ call, store, databasePath });
  } finally {
    try { store.close(); } catch { /* already closed */ }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const jpegBytes = () => Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x01, 0x02, 0x03]);

test("a photo round-trips its exact bytes and mime type", async () => {
  await withService(async ({ call }) => {
    const bytes = jpegBytes();
    const uploaded = await call("PUT", "/diary/kp/log/lunch-1/photo", bytes, { "content-type": "image/jpeg" });
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.body.mimeType, "image/jpeg");

    const fetched = await call("GET", "/diary/kp/log/lunch-1/photo");
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers["content-type"], "image/jpeg");
    assert.deepEqual(fetched.buffer, bytes, "the exact bytes uploaded must be the exact bytes served back");
  });
});

test("re-attaching a photo to the same entry replaces it, leaving no orphan file", async () => {
  await withService(async ({ call, store }) => {
    await call("PUT", "/diary/kp/log/lunch-1/photo", jpegBytes(), { "content-type": "image/jpeg" });
    const secondPhoto = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    await call("PUT", "/diary/kp/log/lunch-1/photo", secondPhoto, { "content-type": "image/png" });

    const fetched = await call("GET", "/diary/kp/log/lunch-1/photo");
    assert.deepEqual(fetched.buffer, secondPhoto, "the newer photo must win");
    assert.equal(fetched.headers["content-type"], "image/png");

    const photosDir = path.join(path.dirname(store.path), "photos");
    const files = fs.readdirSync(photosDir);
    assert.equal(files.length, 1, "the old .jpg file must not linger once replaced by a .png");
  });
});

test("deleting a photo is idempotent and removes it from the diary's photo index", async () => {
  await withService(async ({ call }) => {
    await call("PUT", "/diary/kp/log/lunch-1/photo", jpegBytes(), { "content-type": "image/jpeg" });
    assert.deepEqual(Object.keys((await call("GET", "/diary/kp")).body.photos), ["lunch-1"]);

    assert.equal((await call("DELETE", "/diary/kp/log/lunch-1/photo")).status, 200);
    assert.equal((await call("DELETE", "/diary/kp/log/lunch-1/photo")).status, 200, "deleting an already-gone photo must not error");
    assert.equal((await call("GET", "/diary/kp/log/lunch-1/photo")).status, 404);
    assert.deepEqual((await call("GET", "/diary/kp")).body.photos, {});
  });
});

test("an oversized photo is refused, not truncated", async () => {
  await withService(async ({ call, store }) => {
    const huge = Buffer.alloc(MAX_PHOTO_BYTES + 1, 1);
    const result = await call("PUT", "/diary/kp/log/lunch-1/photo", huge, { "content-type": "image/jpeg" });
    assert.equal(result.status, 413);
    assert.deepEqual(store.listPhotos("kp"), {}, "a refused upload must leave nothing behind");
  });
});

test("an unsupported file type is refused before it ever touches disk", async () => {
  await withService(async ({ call, store }) => {
    const result = await call("PUT", "/diary/kp/log/lunch-1/photo", Buffer.from("not an image"), { "content-type": "application/pdf" });
    assert.equal(result.status, 400);
    assert.deepEqual(store.listPhotos("kp"), {});
  });
});

test("a crafted log id cannot be used to reach outside the photos directory", async () => {
  await withService(async ({ call }) => {
    const result = await call("PUT", "/diary/kp/log/..%2F..%2Fetc%2Fpasswd/photo", jpegBytes(), { "content-type": "image/jpeg" });
    assert.equal(result.status, 400, "a log id must be validated before it ever reaches the filesystem");
  });
});

test("photos belong to one profile, never leak into another's diary response", async () => {
  await withService(async ({ call }) => {
    await call("POST", "/profiles", { id: "wife", name: "Partner" });
    await call("PUT", "/diary/kp/log/mine/photo", jpegBytes(), { "content-type": "image/jpeg" });

    assert.deepEqual(Object.keys((await call("GET", "/diary/kp")).body.photos), ["mine"]);
    assert.deepEqual((await call("GET", "/diary/wife")).body.photos, {}, "one person's photo must never appear on the other's diary");
    assert.equal((await call("GET", "/diary/wife/log/mine/photo")).status, 404, "and it must not even be fetchable under the wrong profile");
  });
});

test("a photo within the age window survives the sweep untouched", async () => {
  await withService(async ({ store }) => {
    store.savePhoto("kp", "fresh-entry", jpegBytes(), "image/jpeg");

    const removed = store.sweepExpiredPhotos(30);

    assert.equal(removed, 0, "a photo saved moments ago is nowhere near 30 days old");
    assert.deepEqual(Object.keys(store.listPhotos("kp")), ["fresh-entry"]);
  });
});

test("the sweep judges by the stored cutoff, not just some fixed number of days", async () => {
  await withService(async ({ store }) => {
    store.savePhoto("kp", "just-saved", jpegBytes(), "image/jpeg");

    // A cutoff in the future (a negative max age) makes even a brand-new photo "expired" —
    // proving the comparison is a real timestamp check, not a no-op that always returns 0.
    const removed = store.sweepExpiredPhotos(-1);

    assert.equal(removed, 1);
    assert.deepEqual(store.listPhotos("kp"), {});
  });
});

test("failure injection: a sweep that forgets to delete the file would leave storage growing forever", async () => {
  await withService(async ({ store }) => {
    store.savePhoto("kp", "leftover", jpegBytes(), "image/jpeg");
    const photosDir = path.join(path.dirname(store.path), "photos");
    assert.equal(fs.readdirSync(photosDir).length, 1);

    store.sweepExpiredPhotos(-1);

    assert.equal(fs.readdirSync(photosDir).length, 0, "the file, not just the database row, must be gone — this is the entire point of a bounded sweep");
  });
});
