import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Readable } from "node:stream";
import { createDiaryHandler, ensureFirstProfile, API_PREFIX } from "../server/diary-service.mjs";
import { openDiaryStore, HISTORY_PER_PROFILE, MAX_PAYLOAD_BYTES } from "../server/diary-store.mjs";

/**
 * These drive the real request handler against a real SQLite file in a temporary
 * directory — real routing, real body parsing, real storage. Only the socket is
 * stood in for, because binding one needs network permission the test runner does
 * not always have, and a suite that only passes with extra privileges is a suite
 * that eventually stops being run. Nothing about the diary itself is mocked: the
 * whole point of leaving browser storage is that the real store survives restarts,
 * so that is exercised by reopening the database, not by faking it.
 */
function fakeRequest(method, endpoint, body) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  request.url = `${API_PREFIX}${endpoint}`;
  return request;
}

function fakeResponse() {
  return {
    status: 0,
    text: "",
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    end(text) { this.text = text ?? ""; },
  };
}

async function withService(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nourish-test-"));
  const databasePath = path.join(directory, "diary.db");
  const store = openDiaryStore(databasePath);
  ensureFirstProfile(store);
  const handle = createDiaryHandler(store);
  const call = async (method, endpoint, body) => {
    const response = fakeResponse();
    const handled = await handle(fakeRequest(method, endpoint, body), response);
    assert.ok(handled, `${method} ${endpoint} was not routed at all`);
    return { status: response.status, body: response.text ? JSON.parse(response.text) : null };
  };
  try {
    await run({ call, store, databasePath, reopen: () => openDiaryStore(databasePath) });
  } finally {
    // A test may have closed it deliberately to prove a restart; closing twice is not a failure.
    try { store.close(); } catch { /* already closed */ }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const diary = (dayKey, logIds) => ({
  schemaVersion: 2,
  days: [{ dayKey, logs: logIds.map((logId) => ({ logId, foodId: "banana", amount: 100 })) }],
  planned: [], targets: null, customFoods: [], userMeals: [], weights: [],
  removed: { customFoods: [], userMeals: [], days: [], weights: [] },
});

test("a brand new database always has somewhere to write", async () => {
  await withService(async ({ call }) => {
    const { status, body } = await call("GET", "/profiles");
    assert.equal(status, 200);
    assert.equal(body.profiles.length, 1, "a diary that cannot be saved is the worst outcome, so one profile always exists");
  });
});

test("two people keep entirely separate diaries", async () => {
  await withService(async ({ call }) => {
    await call("POST", "/profiles", { id: "wife", name: "Partner" });
    await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["kp-lunch"]) });
    await call("PUT", "/diary/wife", { baseRevision: 0, state: diary("2026-08-22", ["her-lunch"]) });

    const mine = await call("GET", "/diary/kp");
    const hers = await call("GET", "/diary/wife");

    assert.deepEqual(mine.body.state.days[0].logs.map((log) => log.logId), ["kp-lunch"]);
    assert.deepEqual(hers.body.state.days[0].logs.map((log) => log.logId), ["her-lunch"], "one person's lunch must never land in the other's total");
  });
});

test("a write built on a stale revision is refused and handed the newer copy", async () => {
  await withService(async ({ call }) => {
    await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["laptop"]) });

    // The phone still thinks the diary is at revision 0.
    const stale = await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["phone"]) });

    assert.equal(stale.status, 409);
    assert.equal(stale.body.revision, 1);
    assert.deepEqual(stale.body.state.days[0].logs.map((log) => log.logId), ["laptop"], "the refusal carries the newer copy, so the caller can merge rather than guess");

    const stored = await call("GET", "/diary/kp");
    assert.deepEqual(stored.body.state.days[0].logs.map((log) => log.logId), ["laptop"], "and the stale write changed nothing");
  });
});

test("the diary survives the service restarting", async () => {
  await withService(async ({ call, store, reopen }) => {
    const durableDiary = {
      ...diary("2026-08-22", ["survivor"]),
      weights: [{ date: "2026-08-22", kg: 72.4 }],
      targets: { calories: 2150, protein: 150, carbs: 215, fat: 72, updatedAt: 1_725_000_000_000 },
    };
    await call("PUT", "/diary/kp", { baseRevision: 0, state: durableDiary });
    store.close();

    // A genuinely fresh handle on the same file, as if the Mac Mini had rebooted.
    const restarted = reopen();
    const read = restarted.readDiary("kp");
    restarted.close();

    assert.equal(read.revision, 1);
    assert.deepEqual(read.state.days[0].logs.map((log) => log.logId), ["survivor"], "this is the entire reason for moving off browser storage");
    assert.deepEqual(read.state.weights, durableDiary.weights, "weight history must live in SQLite, not disappear with a browser cache");
    assert.deepEqual(read.state.targets, durableDiary.targets, "personal targets must survive app and service restarts");
  });
});

test("closing the diary store twice is harmless during coordinated shutdown", async () => {
  await withService(async ({ store }) => {
    store.close();
    assert.doesNotThrow(() => store.close(), "a parent and its child may both finish shutdown cleanup");
  });
});

test("every save is recoverable, so deleting everything is not final", async () => {
  await withService(async ({ call }) => {
    await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["a", "b", "c"]) });
    // The user wipes the diary from Settings and it syncs up as an empty document.
    await call("PUT", "/diary/kp", { baseRevision: 1, state: diary("2026-08-22", []) });

    const current = await call("GET", "/diary/kp");
    assert.equal(current.body.state.days[0].logs.length, 0, "the wipe took effect");

    const history = await call("GET", "/diary/kp/history");
    assert.equal(history.body.history.length, 2);
    const previous = await call("GET", `/diary/kp/history/${history.body.history[1].id}`);
    assert.deepEqual(previous.body.state.days[0].logs.map((log) => log.logId), ["a", "b", "c"], "the copy from before the wipe is still there");
  });
});

test("history is bounded so it cannot fill the disk", async () => {
  await withService(async ({ store }) => {
    for (let revision = 0; revision < HISTORY_PER_PROFILE + 12; revision += 1) {
      store.writeDiary("kp", diary("2026-08-22", [`entry-${revision}`]), revision);
    }
    const history = store.listHistory("kp");
    assert.equal(history.length, HISTORY_PER_PROFILE);
    assert.equal(history[0].revision, HISTORY_PER_PROFILE + 12, "and it is the most recent copies that are kept");
  });
});

test("deleting a profile removes that person and their history, and no one else's", async () => {
  await withService(async ({ call, store }) => {
    await call("POST", "/profiles", { id: "wife", name: "Partner" });
    await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["mine"]) });
    await call("PUT", "/diary/wife", { baseRevision: 0, state: diary("2026-08-22", ["hers"]) });

    assert.equal((await call("DELETE", "/profiles/wife")).status, 200);

    assert.deepEqual(store.listProfiles().map((profile) => profile.id), ["kp"]);
    assert.equal(store.listHistory("wife").length, 0, "her history goes with her");
    assert.equal(store.listHistory("kp").length, 1, "and mine is untouched");
    assert.equal((await call("GET", "/diary/wife")).status, 404);
  });
});

test("malformed and oversized requests are refused, never half-applied", async () => {
  await withService(async ({ call }) => {
    await call("PUT", "/diary/kp", { baseRevision: 0, state: diary("2026-08-22", ["real"]) });

    assert.equal((await call("PUT", "/diary/kp", { state: diary("2026-08-22", []) })).status, 400, "a write with no baseRevision is a bug, not a wipe");
    assert.equal((await call("PUT", "/diary/kp", { baseRevision: 1 })).status, 400);
    assert.equal((await call("POST", "/profiles", { id: "Not Valid!", name: "x" })).status, 400);
    assert.equal((await call("GET", "/diary/nope")).status, 404);
    assert.equal((await call("PUT", "/diary/kp", "{not json")).status, 400);

    const stored = await call("GET", "/diary/kp");
    assert.deepEqual(stored.body.state.days[0].logs.map((log) => log.logId), ["real"], "after every bad request the diary is exactly as it was");
  });
});

test("a diary too large to store is refused rather than truncated", async () => {
  await withService(async ({ store }) => {
    const enormous = { ...diary("2026-08-22", ["a"]), filler: "x".repeat(MAX_PAYLOAD_BYTES) };
    const result = store.writeDiary("kp", enormous, 0);
    assert.deepEqual({ ok: result.ok, reason: result.reason }, { ok: false, reason: "too-large" });
    assert.equal(store.readDiary("kp").revision, 0, "and nothing was written");
  });
});

test("failure injection: a store that quietly kept the old copy would be caught", async () => {
  await withService(async ({ store }) => {
    store.writeDiary("kp", diary("2026-08-22", ["first"]), 0);
    store.writeDiary("kp", diary("2026-08-22", ["second"]), 1);
    const read = store.readDiary("kp");
    assert.deepEqual(read.state.days[0].logs.map((log) => log.logId), ["second"], "a read that returns yesterday's diary is the failure this whole layer exists to prevent");
    assert.equal(read.revision, 2);
  });
});

test("the first profile is only created when there is genuinely nothing", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nourish-bootstrap-"));
  try {
    const store = openDiaryStore(path.join(directory, "diary.db"));
    store.createProfile("wife", "Partner");
    const profiles = ensureFirstProfile(store);
    assert.deepEqual(profiles.map((profile) => profile.id), ["wife"], "an existing household must not sprout an unexpected extra person");
    store.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
