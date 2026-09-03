import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_NUTRITION_STORAGE_KEY,
  MAX_CUSTOM_FOODS,
  MAX_STORED_DAYS,
  MAX_WEIGHT_ENTRIES,
  NUTRITION_BACKUP_STORAGE_KEY,
  emptyNutritionState,
  exportNutritionState,
  isSafeImageUrl,
  mergeNutritionBackup,
  nutritionStorageKeys,
  parseExportedNutritionState,
  parseSavedNutritionState,
  readStoredNutritionRaw,
  stringifySavedNutritionState,
  writeStoredNutritionState,
  type PersistedNutritionState,
  type StorageLike,
} from "../app/local-nutrition-state";
import { nutritionItems } from "../app/nutrition-data";
import { MAX_USER_MEALS, type UserMeal } from "../app/logging-session";

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

test("target edit times round-trip and separate profiles never overwrite one another", () => {
  const storage = memoryStorage();
  const mine = stateWith({ targets: { calories: 2200, protein: 150, carbs: 220, fat: 70, updatedAt: 1_725_000_000_000 } });
  const partner = stateWith({ targets: { calories: 1800, protein: 120, carbs: 175, fat: 58, updatedAt: 1_725_000_000_001 } });

  writeStoredNutritionState(storage, mine, nutritionStorageKeys("kp"));
  writeStoredNutritionState(storage, partner, nutritionStorageKeys("partner"));

  assert.deepEqual(parseSavedNutritionState(readStoredNutritionRaw(storage, nutritionStorageKeys("kp"))!).targets, mine.targets);
  assert.deepEqual(parseSavedNutritionState(readStoredNutritionRaw(storage, nutritionStorageKeys("partner"))!).targets, partner.targets);

  const legacy = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], customFoods: [], userMeals: [], weights: [], targets: { calories: 2100, protein: 145, carbs: 210, fat: 68 } }));
  assert.deepEqual(legacy.targets, { calories: 2100, protein: 145, carbs: 210, fat: 68 }, "backups from before target timestamps must remain readable");
});

test("backup merge keeps every current record and reports only genuine additions", () => {
  const currentFood = { ...aFood, name: "Current food" };
  const backupFood = { ...aFood, name: "Stale backup food" };
  const currentMeal: UserMeal = { id: "meal-one", name: "Current meal", createdAt: "2026-08-14", components: [currentFood] };
  const backupMeal: UserMeal = { ...currentMeal, name: "Stale backup meal" };
  const current = stateWith({
    days: [aDay],
    customFoods: [currentFood],
    userMeals: [currentMeal],
    weights: [{ date: "2026-08-14", kg: 72 }],
    targets: { calories: 2100, protein: 140, carbs: 220, fat: 70 },
    carried: { currentOnly: true, collision: "current" },
  }) as ReturnType<typeof emptyNutritionState>;
  const restored = stateWith({
    days: [{ ...aDay, logs: [{ ...aDay.logs[0], amount: 999 }] }, { dayKey: "2026-08-13", logs: aDay.logs }],
    customFoods: [backupFood, { ...aFood, id: "custom-from-backup" }],
    userMeals: [backupMeal, { ...backupMeal, id: "meal-from-backup" }],
    weights: [{ date: "2026-08-14", kg: 99 }, { date: "2026-08-13", kg: 71.5 }],
    targets: { calories: 9999, protein: 1, carbs: 1, fat: 1 },
    carried: { backupOnly: true, collision: "backup" },
  }) as ReturnType<typeof emptyNutritionState>;

  const merged = mergeNutritionBackup(current, restored);
  assert.deepEqual(merged.added, { days: 1, customFoods: 1, userMeals: 1, weights: 1, targets: 0 });
  assert.deepEqual(merged.collisions, { days: 1, customFoods: 1, userMeals: 1, weights: 1, targets: 1 });
  assert.deepEqual(merged.skippedAtCapacity, { days: 0, customFoods: 0, userMeals: 0, weights: 0, targets: 0 });
  assert.deepEqual(merged.state.days.find((day) => day.dayKey === aDay.dayKey), aDay, "current day wins a date collision");
  assert.equal(merged.state.customFoods.find((food) => food.id === aFood.id)?.name, "Current food");
  assert.equal(merged.state.userMeals.find((meal) => meal.id === currentMeal.id)?.name, "Current meal");
  assert.equal(merged.state.weights.find((entry) => entry.date === "2026-08-14")?.kg, 72);
  assert.deepEqual(merged.state.targets, current.targets);
  assert.deepEqual(merged.state.carried, { backupOnly: true, currentOnly: true, collision: "current" });
});

test("a full live store refuses backup overflow instead of evicting current data", () => {
  const days = Array.from({ length: MAX_STORED_DAYS }, (_, index) => ({
    dayKey: new Date(Date.UTC(2025, 0, 1) + index * 86400000).toISOString().slice(0, 10),
    logs: aDay.logs,
  })).sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  const customFoods = Array.from({ length: MAX_CUSTOM_FOODS }, (_, index) => ({ ...aFood, id: `current-food-${index}` }));
  const userMeals = Array.from({ length: MAX_USER_MEALS }, (_, index): UserMeal => ({ id: `current-meal-${index}`, name: `Meal ${index}`, createdAt: "2026-08-14", components: [aFood] }));
  const weights = Array.from({ length: MAX_WEIGHT_ENTRIES }, (_, index) => ({ date: new Date(Date.UTC(2010, 0, 1) + index * 86400000).toISOString().slice(0, 10), kg: 72 }));
  const current = stateWith({ days, customFoods, userMeals, weights }) as ReturnType<typeof emptyNutritionState>;
  const restored = stateWith({
    days: [{ dayKey: "2099-01-01", logs: aDay.logs }],
    customFoods: [{ ...aFood, id: "backup-food" }],
    userMeals: [{ id: "backup-meal", name: "Backup", createdAt: "2026-08-14", components: [aFood] }],
    weights: [{ date: "2009-12-31", kg: 70 }],
  }) as ReturnType<typeof emptyNutritionState>;

  const merged = mergeNutritionBackup(current, restored);
  assert.deepEqual(merged.added, { days: 0, customFoods: 0, userMeals: 0, weights: 0, targets: 0 });
  assert.deepEqual(merged.skippedAtCapacity, { days: 1, customFoods: 1, userMeals: 1, weights: 1, targets: 0 });
  assert.deepEqual(merged.state.days, current.days);
  assert.deepEqual(merged.state.customFoods, current.customFoods);
  assert.deepEqual(merged.state.userMeals, current.userMeals);
  assert.deepEqual(merged.state.weights, current.weights);
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(merged.state));
  assert.equal(reloaded.days.length, MAX_STORED_DAYS, "round-trip must retain all current days");
  assert.equal(reloaded.customFoods.length, MAX_CUSTOM_FOODS, "round-trip must retain all current foods");
  assert.equal(reloaded.userMeals.length, MAX_USER_MEALS, "round-trip must retain all current meals");
  assert.equal(reloaded.weights.length, MAX_WEIGHT_ENTRIES, "round-trip must retain all current weights");
});

test("backup parsing rejects impossible and future diary dates", () => {
  const raw = stringifySavedNutritionState(stateWith({
    days: [
      { dayKey: "2026-99-99", logs: aDay.logs },
      { dayKey: "2999-01-01", logs: aDay.logs },
      aDay,
    ],
  }));
  const restored = parseSavedNutritionState(raw);
  assert.deepEqual(restored.days, [aDay]);
  assert.ok(restored.rejected >= 2, "discarded diary days must be reported, not disappear silently");
});

/**
 * Food photos KP takes himself are served from the diary database over a
 * same-origin path with no scheme. `isSafeImageUrl` guards what reaches an
 * <img src>, so it has to allow exactly that shape and nothing looser.
 */
test("a food photo path from the diary database is treated as safe", () => {
  assert.equal(isSafeImageUrl("/api/nourish/diary/kp/food/abc123/photo"), true);
  assert.equal(isSafeImageUrl("/api/nourish/diary/kp/food/abc123/photo?v=1724928000000"), true);
});

test("only the diary API's own paths are allowed without a scheme", () => {
  assert.equal(isSafeImageUrl("/etc/passwd"), false);
  assert.equal(isSafeImageUrl("/api/other/thing.png"), false);
  assert.equal(isSafeImageUrl("/api/nourish/diary/kp/log/lunch-1/photo"), false);
  assert.equal(isSafeImageUrl("//evil.example.com/x.png"), false);
  // A traversal out of the API prefix must not be talked into passing.
  assert.equal(isSafeImageUrl("/api/nourish/../../secret.png"), false);
});

test("javascript: and data: urls are still refused", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("data:image/png;base64,AAAA"), false);
  assert.equal(isSafeImageUrl(""), false);
  assert.equal(isSafeImageUrl(undefined), false);
});
