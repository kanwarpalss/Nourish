import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CUSTOM_FOODS,
  MAX_REMOVED_IDS,
  canRestoreRecord,
  clearAllUserData,
  emptyNutritionState,
  exportNutritionState,
  isRemoved,
  mergeSyncedStates,
  mergeNutritionBackup,
  parseExportedNutritionState,
  parseSavedNutritionState,
  removeRecord,
  restoreRecord,
  stringifySavedNutritionState,
  withDayLogs,
  type SavedNutritionState,
} from "../app/local-nutrition-state";
import { nutritionItems } from "../app/nutrition-data";
import type { UserMeal } from "../app/logging-session";

const seedFood = nutritionItems[0];

function stateWith(overrides: Partial<SavedNutritionState> = {}): SavedNutritionState {
  return { ...emptyNutritionState(), ...overrides };
}

const myFood = { ...seedFood, id: "custom-mine-1", name: "My Thing", source: { label: "Added by you", url: "", trust: "Personal" as const } };
const myMeal: UserMeal = { id: "usermeal-mine-1", name: "Post-gym plate", createdAt: "2026-08-14", components: [{ ...seedFood }] };
const aDay = { dayKey: "2026-08-14", logs: [{ foodId: seedFood.id, amount: 100 }] };
const anotherDay = { dayKey: "2026-08-15", logs: [{ foodId: seedFood.id, amount: 50 }] };

test("deleting a saved meal removes it and remembers that it was deleted", () => {
  const before = stateWith({ userMeals: [myMeal] });
  const { state, removed } = removeRecord(before, "userMeal", myMeal.id);

  assert.equal(state.userMeals.length, 0, "the meal is gone");
  assert.deepEqual(removed, { kind: "userMeal", meal: myMeal }, "and comes back whole, so Undo has something to restore");
  assert.ok(isRemoved(state.removed, "userMeal", myMeal.id), "the deletion is recorded");
});

test("Undo puts a deleted record back and forgets the deletion", () => {
  const { state, removed } = removeRecord(stateWith({ userMeals: [myMeal] }), "userMeal", myMeal.id);
  assert.ok(removed);
  const undone = restoreRecord(state, removed);

  assert.deepEqual(undone.userMeals, [myMeal], "the meal is back exactly as it was");
  assert.equal(isRemoved(undone.removed, "userMeal", myMeal.id), false, "and is no longer marked deleted, so a backup can restore it again");
});

test("a backup taken before a deletion must not resurrect what was deleted", () => {
  // The whole reason tombstones exist. Restore is deliberately additive — on a
  // collision what is here wins and nothing is removed — so without a record of
  // the deletion, importing any older backup silently undoes every delete.
  const before = stateWith({ userMeals: [myMeal], customFoods: [myFood], weights: [{ date: "2026-08-14", kg: 74 }], days: [aDay] });
  const backupFile = exportNutritionState(before, "2026-08-14T00:00:00.000Z");

  let live: SavedNutritionState = before;
  for (const [kind, id] of [["userMeal", myMeal.id], ["customFood", myFood.id], ["weight", "2026-08-14"], ["day", aDay.dayKey]] as const) {
    live = removeRecord(live, kind, id).state;
  }
  assert.equal(live.userMeals.length + live.customFoods.length + live.weights.length + live.days.length, 0, "everything was deleted");

  const restored = parseExportedNutritionState(backupFile);
  assert.ok(restored, "the backup itself is still readable");
  const merged = mergeNutritionBackup(live, restored);

  assert.equal(merged.state.userMeals.length, 0, "the deleted meal stays deleted");
  assert.equal(merged.state.customFoods.length, 0, "so does the deleted food");
  assert.equal(merged.state.weights.length, 0, "and the deleted weigh-in");
  assert.equal(merged.state.days.length, 0, "and the deleted day");
  assert.equal(merged.skippedAsDeleted.userMeals + merged.skippedAsDeleted.customFoods + merged.skippedAsDeleted.weights + merged.skippedAsDeleted.days, 4, "and KP is told four records were held back rather than it happening in silence");
});

test("a backup cannot resurrect an individually deleted diary entry", () => {
  const day = { dayKey: "2026-08-14", logs: [{ logId: "deleted-breakfast", foodId: seedFood.id, amount: 100 }] };
  const before = stateWith({ days: [day] });
  const backup = parseExportedNutritionState(exportNutritionState(before, "2026-08-14T00:00:00.000Z"));
  assert.ok(backup);
  const live = withDayLogs(before, day.dayKey, []);

  const merged = mergeNutritionBackup(live, backup);

  assert.deepEqual(merged.state.days, [], "restore is additive, but a known-deleted log is not an addition");
  assert.equal(isRemoved(merged.state.removed, "log", "deleted-breakfast"), true);
  assert.equal(merged.skippedAsDeleted.days, 1, "the restore report must reveal that deleted content was held back");
});

test("restoring a backup still never removes anything that is here now", () => {
  // The inverse guard. A backup that knows about deletions must not apply them
  // to live data — that would let a stale file undo today's work.
  const backupState = removeRecord(stateWith({ userMeals: [myMeal] }), "userMeal", myMeal.id).state;
  const fromFile = parseExportedNutritionState(exportNutritionState(backupState, "2026-08-14T00:00:00.000Z"))
    ?? stateWith();
  const live = stateWith({ userMeals: [myMeal], days: [aDay] });

  const merged = mergeNutritionBackup(live, fromFile);

  assert.deepEqual(merged.state.userMeals, [myMeal], "the live meal survives a backup that had deleted it");
  assert.deepEqual(merged.state.days, [aDay], "and so does the live diary");
  assert.equal(isRemoved(merged.state.removed, "userMeal", myMeal.id), false, "the file's deletions are not adopted");
});

test("deleting a food you created also clears it out of the plan draft", () => {
  const before = stateWith({ customFoods: [myFood], planned: [{ id: myFood.id, kind: "food" }, { id: seedFood.id, kind: "food" }] });
  const { state } = removeRecord(before, "customFood", myFood.id);

  assert.deepEqual(state.planned, [{ id: seedFood.id, kind: "food" }], "the plan line naming the deleted food goes with it, and nothing else does");
});

test("Undo restores every planned copy of a deleted food in its original positions", () => {
  const before = stateWith({
    customFoods: [myFood],
    planned: [
      { id: seedFood.id, kind: "food" },
      { id: myFood.id, kind: "food" },
      { id: seedFood.id, kind: "food" },
      { id: myFood.id, kind: "food" },
    ],
  });
  const deleted = removeRecord(before, "customFood", myFood.id);
  assert.ok(deleted.removed);

  const undone = restoreRecord(deleted.state, deleted.removed);

  assert.deepEqual(undone.planned, before.planned, "Undo must restore every Plan consequence, not only the catalogue item");
});

test("Undo beats an older synced deletion decision", () => {
  const before = stateWith({ customFoods: [myFood] });
  const deletedOnPhone = removeRecord(before, "customFood", myFood.id).state;
  const deletedOnLaptop = removeRecord(before, "customFood", myFood.id);
  assert.ok(deletedOnLaptop.removed);
  const undoneOnLaptop = restoreRecord(deletedOnLaptop.state, deletedOnLaptop.removed);

  const merged = mergeSyncedStates(undoneOnLaptop, deletedOnPhone);

  assert.deepEqual(merged.customFoods, [myFood], "a later Undo must not be silently erased by an earlier synced deletion");
  assert.equal(isRemoved(merged.removed, "customFood", myFood.id), false, "the restored decision is carried to every device");
});

test("Undo at the item limit refuses to evict an unrelated food", () => {
  const deleted = removeRecord(stateWith({ customFoods: [myFood] }), "customFood", myFood.id);
  assert.ok(deleted.removed);
  const full = {
    ...deleted.state,
    customFoods: Array.from({ length: MAX_CUSTOM_FOODS }, (_, index) => ({ ...myFood, id: `custom-new-${index}` })),
  };

  assert.equal(canRestoreRecord(full, deleted.removed), false, "the caller can keep Undo available and explain why it cannot fit yet");
  assert.deepEqual(restoreRecord(full, deleted.removed), full, "restoring must never slice away somebody else's item");
});

test("deleting one day leaves every other day untouched", () => {
  const { state } = removeRecord(stateWith({ days: [anotherDay, aDay] }), "day", aDay.dayKey);

  assert.deepEqual(state.days.map((day) => day.dayKey), [anotherDay.dayKey], "only the named day is removed");
});

test("logging again on a deleted day un-deletes it", () => {
  const { state } = removeRecord(stateWith({ days: [aDay] }), "day", aDay.dayKey);
  assert.ok(isRemoved(state.removed, "day", aDay.dayKey));

  const relogged = withDayLogs(state, aDay.dayKey, aDay.logs);

  assert.equal(relogged.days.length, 1, "the day is back");
  assert.equal(isRemoved(relogged.removed, "day", aDay.dayKey), false, "and is no longer blocked from ever being restored");
});

test("clearing a day's last entry does not permanently tombstone that day", () => {
  // Removing entries one by one until a day is empty is not the same decision as
  // deleting the day, and must not silently block restoring it later.
  const emptied = withDayLogs(stateWith({ days: [aDay] }), aDay.dayKey, []);

  assert.equal(emptied.days.length, 0, "the empty day is dropped from storage as before");
  assert.equal(isRemoved(emptied.removed, "day", aDay.dayKey), false, "but it is not marked as a deliberate deletion");
});

test("deleting something that is not there changes nothing", () => {
  const before = stateWith({ userMeals: [myMeal] });
  const { state, removed } = removeRecord(before, "userMeal", "usermeal-never-existed");

  assert.equal(removed, null, "there is nothing to undo");
  assert.deepEqual(state, before, "and nothing is tombstoned on a double tap");
});

test("deletions survive a save and reload", () => {
  const { state } = removeRecord(stateWith({ userMeals: [myMeal] }), "userMeal", myMeal.id);
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));

  assert.ok(isRemoved(reloaded.removed, "userMeal", myMeal.id), "a deletion that vanished on reload would resurrect on the next restore");
});

test("a damaged deletion list loses the deletions, never the diary", () => {
  const stored = JSON.parse(stringifySavedNutritionState(stateWith({ days: [aDay], userMeals: [myMeal] })));
  const parsed = parseSavedNutritionState(JSON.stringify({ ...stored, removed: { userMeals: [42, null, "usermeal-real"], days: "not-a-list" } }));

  assert.deepEqual(parsed.removed.userMeals, ["usermeal-real"], "usable ids are kept, junk is dropped");
  assert.deepEqual(parsed.removed.days, [], "an unusable list becomes an empty one");
  assert.equal(parsed.days.length, 1, "and the diary itself is untouched");
});

test("the deletion record is bounded", () => {
  let state = stateWith();
  const overflowing = Array.from({ length: MAX_REMOVED_IDS + 25 }, (_, index) => ({ ...myMeal, id: `usermeal-${index}` }));
  for (const meal of overflowing) {
    state = removeRecord({ ...state, userMeals: [meal] }, "userMeal", meal.id).state;
  }

  assert.equal(state.removed.userMeals.length, MAX_REMOVED_IDS, "the list is capped so deleting often cannot fill storage");
  assert.ok(isRemoved(state.removed, "userMeal", `usermeal-${MAX_REMOVED_IDS + 24}`), "and it is the most recent deletions that are kept");
});

test("delete everything clears the data and the deletions, but not another build's fields", () => {
  const withEverything = parseSavedNutritionState(JSON.stringify({
    ...JSON.parse(stringifySavedNutritionState(stateWith({ days: [aDay], userMeals: [myMeal], customFoods: [myFood], weights: [{ date: "2026-08-14", kg: 74 }], targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 } }))),
    hydrationLog: [{ date: "2026-08-14", ml: 2200 }],
  }));
  const cleared = clearAllUserData(removeRecord(withEverything, "userMeal", myMeal.id).state);

  assert.deepEqual([cleared.days, cleared.userMeals, cleared.customFoods, cleared.weights, cleared.planned], [[], [], [], [], []]);
  assert.equal(cleared.targets, null, "targets go back to unset");
  assert.deepEqual(cleared.removed.userMeals, [], "a reset KP cannot restore his own backup into would be a trap");
  assert.deepEqual(cleared.carried?.hydrationLog, [{ date: "2026-08-14", ml: 2200 }], "clearing this build's data is not licence to delete another build's");
});
