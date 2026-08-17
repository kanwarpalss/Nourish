import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_NUTRITION_STORAGE_KEY,
  NUTRITION_BACKUP_STORAGE_KEY,
  emptyNutritionState,
  exportNutritionState,
  parseExportedNutritionState,
  parseSavedNutritionState,
  readStoredNutritionRaw,
  stringifySavedNutritionState,
  writeStoredNutritionState,
  type PersistedNutritionState,
  type StorageLike,
} from "../app/local-nutrition-state";
import { nutritionItems } from "../app/nutrition-data";

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  const storage: StorageLike & { map: Map<string, string> } = {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
  return storage;
}

function stateWith(overrides: Partial<PersistedNutritionState> = {}): PersistedNutritionState {
  const { rejected: _ignored, ...base } = emptyNutritionState();
  return { ...base, ...overrides };
}

const aFood = { ...nutritionItems[0], id: "custom-mine" };
const aDay = { dayKey: "2026-08-14", logs: [{ foodId: nutritionItems[0].id, amount: 100 }] };

test("a build that does not know a field must not delete it", () => {
  // The bug: stringify used to keep only the seven fields it knew, so anything a
  // newer build wrote was silently dropped the next time an older build saved.
  const fromNewerBuild = {
    ...JSON.parse(stringifySavedNutritionState(stateWith({ days: [aDay] }))),
    hydrationLog: [{ date: "2026-08-14", ml: 2200 }],
    someFutureThing: { nested: true },
  };
  const parsed = parseSavedNutritionState(JSON.stringify(fromNewerBuild));
  assert.deepEqual(parsed.carried?.hydrationLog, fromNewerBuild.hydrationLog, "unknown fields must be carried, not discarded");

  const rewritten = JSON.parse(stringifySavedNutritionState(parsed));
  assert.deepEqual(rewritten.hydrationLog, fromNewerBuild.hydrationLog, "and re-emitted on the next save");
  assert.deepEqual(rewritten.someFutureThing, { nested: true });
  assert.equal(rewritten.carried, undefined, "carried is a mechanism, not a stored field");
  assert.equal(rewritten.rejected, undefined, "load-only fields still never persist");
  assert.equal(rewritten.days.length, 1, "and the known data is unharmed");
});

test("this build's own fields always win over a carried copy", () => {
  const conflicting = { ...JSON.parse(stringifySavedNutritionState(stateWith({ weights: [{ date: "2026-08-14", kg: 72 }] }))) };
  const parsed = parseSavedNutritionState(JSON.stringify(conflicting));
  // Force a carried value that collides with a real key; the real key must survive.
  const tampered = { ...parsed, carried: { weights: "nonsense", extra: 1 } };
  const written = JSON.parse(stringifySavedNutritionState(tampered));
  assert.ok(Array.isArray(written.weights), "a carried collision must never replace real data");
  assert.equal(written.extra, 1);
});

test("the backup mirrors the last known-good save, not the one before it", () => {
  const storage = memoryStorage();
  writeStoredNutritionState(storage, stateWith({ days: [aDay] }));
  // A pre-write snapshot would be empty here, and recovery would lose today's log.
  assert.equal(parseSavedNutritionState(storage.getItem(NUTRITION_BACKUP_STORAGE_KEY)!).days.length, 1, "the very first save must already be backed up");

  writeStoredNutritionState(storage, stateWith({ days: [aDay], customFoods: [aFood] }));
  assert.equal(parseSavedNutritionState(storage.getItem(NUTRITION_BACKUP_STORAGE_KEY)!).customFoods.length, 1, "the backup tracks the newest good state");
  assert.equal(storage.getItem(NUTRITION_BACKUP_STORAGE_KEY), storage.getItem(LOCAL_NUTRITION_STORAGE_KEY));
});

test("a save that cannot be written must throw, but a failed mirror must not", () => {
  const liveOnly: StorageLike = {
    getItem: () => null,
    setItem: (key) => { if (key === NUTRITION_BACKUP_STORAGE_KEY) throw new Error("QuotaExceededError"); },
  };
  assert.doesNotThrow(() => writeStoredNutritionState(liveOnly, stateWith({ days: [aDay] })), "a full backup slot must not fail the real save");

  const noRoom: StorageLike = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.throws(() => writeStoredNutritionState(noRoom, stateWith({ days: [aDay] })), /Quota/, "a diary that cannot be written must surface, never fail silently");
});

test("a corrupted live key recovers from the backup instead of showing an empty diary", () => {
  const good = stringifySavedNutritionState(stateWith({ days: [aDay], weights: [{ date: "2026-08-14", kg: 72 }] }));
  const storage = memoryStorage({ [LOCAL_NUTRITION_STORAGE_KEY]: "{ truncated json", [NUTRITION_BACKUP_STORAGE_KEY]: good });
  const raw = readStoredNutritionRaw(storage);
  assert.ok(raw);
  const restored = parseSavedNutritionState(raw);
  assert.equal(restored.days.length, 1, "the diary must come back rather than reading as empty");
  assert.equal(restored.weights.length, 1);

  // Failure injection: with a readable live key, the backup must NOT win.
  // A day with no logs is legitimately dropped by normaliseDays, so give it one.
  const live = stringifySavedNutritionState(stateWith({ days: [aDay, { dayKey: "2026-08-13", logs: [{ foodId: nutritionItems[0].id, amount: 50 }] }] }));
  const healthy = memoryStorage({ [LOCAL_NUTRITION_STORAGE_KEY]: live, [NUTRITION_BACKUP_STORAGE_KEY]: good });
  assert.equal(parseSavedNutritionState(readStoredNutritionRaw(healthy)!).days.length, 2, "a healthy live key is always preferred");

  // Nothing anywhere is not an error, just an empty start.
  assert.equal(readStoredNutritionRaw(memoryStorage()), null);
});

test("a storage that throws on read does not take the app down with it", () => {
  const hostile: StorageLike = {
    getItem: (key) => { if (key === LOCAL_NUTRITION_STORAGE_KEY) throw new Error("SecurityError"); return null; },
    setItem: () => undefined,
  };
  assert.equal(readStoredNutritionRaw(hostile), null, "an unreadable key is skipped, not fatal");
});

test("an export round-trips, and a wrong file is refused rather than half-imported", () => {
  const original = stateWith({ days: [aDay], customFoods: [aFood], weights: [{ date: "2026-08-14", kg: 72.4 }], targets: { calories: 2150, protein: 150, carbs: 215, fat: 72 } });
  const file = exportNutritionState(original, "2026-08-14T10:00:00.000Z");
  assert.match(file, /"kind": "nourish-backup"/);
  assert.match(file, /"exportedAt"/);

  const restored = parseExportedNutritionState(file);
  assert.ok(restored, "our own export must import");
  assert.equal(restored.days.length, 1);
  assert.equal(restored.customFoods.length, 1);
  assert.equal(restored.weights[0].kg, 72.4);
  assert.deepEqual(restored.targets, original.targets);

  // A bare state object is accepted too, so a hand-copied localStorage value works.
  assert.ok(parseExportedNutritionState(stringifySavedNutritionState(original)));

  // Anything else is refused outright.
  for (const junk of ['{"kind":"something-else","state":{}}', "not json at all", "[]", "null", '{"app":"nourish"}', JSON.stringify({ kind: "nourish-backup", state: {} })]) {
    assert.equal(parseExportedNutritionState(junk), null, `must refuse: ${junk.slice(0, 40)}`);
  }
});
