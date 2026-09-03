import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyNutritionState,
  isRemoved,
  mergeSyncedStates,
  removeRecord,
  withDayLogs,
  withLogIds,
  type SavedNutritionState,
} from "../app/local-nutrition-state";
import { nutritionItems } from "../app/nutrition-data";
import type { UserMeal } from "../app/logging-session";

const seedFood = nutritionItems[0];

function stateWith(overrides: Partial<SavedNutritionState> = {}): SavedNutritionState {
  return { ...emptyNutritionState(), ...overrides };
}

const entry = (logId: string, amount = 100) => ({ logId, foodId: seedFood.id, amount });
const myMeal: UserMeal = { id: "usermeal-mine-1", name: "Post-gym plate", createdAt: "2026-08-14", components: [{ ...seedFood }] };
const myFood = { ...seedFood, id: "custom-mine-1", source: { label: "Added by you", url: "", trust: "Personal" as const } };

function counter(prefix = "id") {
  let next = 0;
  return () => `${prefix}-${(next += 1)}`;
}

test("food logged on two devices on the same day survives the merge", () => {
  // The failure this prevents: lunch on the phone and dinner on the laptop are both
  // "entry 2" of 14 August. Anything keyed on position keeps one and drops the other.
  const phone = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("breakfast"), entry("lunch")] }] });
  const laptop = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("breakfast"), entry("dinner")] }] });

  const merged = mergeSyncedStates(phone, laptop);

  assert.deepEqual(merged.days[0].logs.map((log) => log.logId), ["breakfast", "lunch", "dinner"], "every meal survives, and the local order is kept");
});

test("a deleted diary entry stays deleted when another device still has it", () => {
  const before = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("breakfast"), entry("lunch")] }] });
  const phone = withDayLogs(before, "2026-08-14", [entry("lunch")]);
  const laptop = before;

  const merged = mergeSyncedStates(phone, laptop);

  assert.deepEqual(merged.days[0]?.logs.map((log) => log.logId), ["lunch"], "sync must not resurrect a log deliberately removed elsewhere");
  assert.equal(isRemoved(merged.removed, "log", "breakfast"), true, "the log-level deletion must travel with the diary");
});

test("Undo of a diary entry beats the older synced deletion", () => {
  const before = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("breakfast"), entry("lunch")] }] });
  const deleted = withDayLogs(before, "2026-08-14", [entry("lunch")]);
  const undone = withDayLogs(deleted, "2026-08-14", [entry("breakfast"), entry("lunch")]);

  const merged = mergeSyncedStates(undone, deleted);

  assert.deepEqual(merged.days[0]?.logs.map((log) => log.logId), ["breakfast", "lunch"]);
  assert.equal(isRemoved(merged.removed, "log", "breakfast"), false, "a deliberate later Undo must survive the next sync");
});

test("deleting the last log keeps the day empty across devices", () => {
  const before = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("only-log")] }] });
  const emptied = withDayLogs(before, "2026-08-14", []);

  const merged = mergeSyncedStates(emptied, before);

  assert.deepEqual(merged.days, [], "an older device must not recreate a day whose only entry was removed");
  assert.equal(isRemoved(merged.removed, "log", "only-log"), true);
});

test("a deletion made on one device reaches the other", () => {
  // Restoring a backup must never delete live data, but syncing must — otherwise
  // every sync resurrects what was deleted on the other device.
  const phone = removeRecord(stateWith({ userMeals: [myMeal] }), "userMeal", myMeal.id).state;
  const laptop = stateWith({ userMeals: [myMeal] });

  const merged = mergeSyncedStates(laptop, phone);

  assert.deepEqual(merged.userMeals, [], "the meal deleted on the phone is gone from the laptop too");
  assert.ok(isRemoved(merged.removed, "userMeal", myMeal.id), "and the deletion is carried forward, so it does not come back next sync");
});

test("deleting on one device does not delete what the other device added afterwards", () => {
  const phone = removeRecord(stateWith({ customFoods: [myFood] }), "customFood", myFood.id).state;
  const newFood = { ...seedFood, id: "custom-later-1", source: { label: "Added by you", url: "", trust: "Personal" as const } };
  const laptop = stateWith({ customFoods: [myFood, newFood] });

  const merged = mergeSyncedStates(laptop, phone);

  assert.deepEqual(merged.customFoods.map((food) => food.id), ["custom-later-1"], "only the deleted food goes");
});

test("days only one device has are kept, from either side", () => {
  const phone = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("a")] }] });
  const laptop = stateWith({ days: [{ dayKey: "2026-08-13", logs: [entry("b")] }] });

  const merged = mergeSyncedStates(laptop, phone);

  assert.deepEqual(merged.days.map((day) => day.dayKey), ["2026-08-14", "2026-08-13"], "newest first, nothing dropped");
});

test("a day written before entry ids existed keeps the fuller side", () => {
  // Mid-migration one side may still be unidentified. Guessing at a union would
  // duplicate meals; keeping the fuller side is the conservative answer.
  const richer = stateWith({ days: [{ dayKey: "2026-08-14", logs: [{ foodId: seedFood.id, amount: 100 }, { foodId: seedFood.id, amount: 50 }] }] });
  const sparser = stateWith({ days: [{ dayKey: "2026-08-14", logs: [{ foodId: seedFood.id, amount: 100 }] }] });

  assert.equal(mergeSyncedStates(sparser, richer).days[0].logs.length, 2, "never fewer entries than the fuller copy");
  assert.equal(mergeSyncedStates(richer, sparser).days[0].logs.length, 2, "whichever way round the merge runs");
});

test("syncing twice changes nothing the second time", () => {
  // A merge that keeps growing would duplicate a meal on every sync.
  const phone = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("a"), entry("b")] }], userMeals: [myMeal] });
  const laptop = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("a"), entry("c")] }] });

  const once = mergeSyncedStates(phone, laptop);
  const twice = mergeSyncedStates(once, laptop);

  assert.deepEqual(twice, once, "merging is stable, so repeated syncs cannot multiply entries");
});

test("the latest target edit wins across devices while the plan stays local", () => {
  const laptop = stateWith({ targets: { calories: 2200, protein: 150, carbs: 220, fat: 70 }, planned: [{ id: seedFood.id, kind: "food" }] });
  const phone = stateWith({ targets: { calories: 1800, protein: 120, carbs: 180, fat: 60, updatedAt: 200 }, planned: [] });

  const merged = mergeSyncedStates(laptop, phone);

  assert.equal(merged.targets?.calories, 1800, "a stale browser must not overwrite the newer target already on the Mini");
  assert.equal(mergeSyncedStates(phone, laptop).targets?.calories, 1800, "merge direction cannot change which target wins");
  assert.deepEqual(merged.planned, [{ id: seedFood.id, kind: "food" }], "and its own scratch plan");
  assert.equal(mergeSyncedStates(stateWith(), phone).targets?.calories, 1800, "but an unset target adopts the other device's");

  const legacyRemote = stateWith({ targets: { calories: 1900, protein: 130, carbs: 190, fat: 60 } });
  assert.equal(mergeSyncedStates(laptop, legacyRemote).targets?.calories, 2200, "two legacy targets retain the established local-first tie-break");

  const simultaneous = stateWith({ targets: { calories: 1700, protein: 110, carbs: 170, fat: 55, updatedAt: 200 } });
  assert.equal(mergeSyncedStates(phone, simultaneous).targets?.calories, 1800, "same-millisecond edits resolve deterministically to the visible device");
});

test("entries are stamped with ids once, and keep them", () => {
  const state = stateWith({ days: [{ dayKey: "2026-08-14", logs: [{ foodId: seedFood.id, amount: 100 }, { foodId: seedFood.id, amount: 50 }] }] });

  const stamped = withLogIds(state, counter());
  assert.deepEqual(stamped.days[0].logs.map((log) => log.logId), ["id-1", "id-2"]);

  const again = withLogIds(stamped, counter("other"));
  assert.equal(again, stamped, "a second pass is a no-op and does not even copy the object");
});

test("two entries claiming the same id are separated", () => {
  const collided = stateWith({ days: [{ dayKey: "2026-08-14", logs: [entry("same"), entry("same", 50)] }] });

  const fixed = withLogIds(collided, counter("fresh"));
  const ids = fixed.days[0].logs.map((log) => log.logId);

  assert.equal(new Set(ids).size, 2, "a duplicate id would collapse two meals into one on the next sync");
  assert.equal(ids[0], "same", "the first claim keeps the id");
});

test("an empty device adopts the server's diary wholesale", () => {
  // The first thing a new phone does: it has nothing, and must end up with everything.
  const server = stateWith({
    days: [{ dayKey: "2026-08-14", logs: [entry("a")] }],
    customFoods: [myFood],
    userMeals: [myMeal],
    weights: [{ date: "2026-08-14", kg: 74 }],
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  });

  const merged = mergeSyncedStates(emptyNutritionState(), server);

  assert.equal(merged.days.length, 1);
  assert.equal(merged.customFoods.length, 1);
  assert.equal(merged.userMeals.length, 1);
  assert.equal(merged.weights.length, 1);
  assert.equal(merged.targets?.calories, 2000);
});

test("a field this build does not know survives a sync in both directions", () => {
  const local = { ...stateWith(), carried: { localOnly: 1 } };
  const remote = { ...stateWith(), carried: { remoteOnly: 2, localOnly: 99 } };

  const merged = mergeSyncedStates(local, remote);

  assert.deepEqual(merged.carried, { remoteOnly: 2, localOnly: 1 }, "both are kept and this device wins the clash");
});
