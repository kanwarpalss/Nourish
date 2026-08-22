import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyNutritionState,
  getWeightTrendPoints,
  logsForDay,
  MAX_STORED_DAYS,
  parseSavedNutritionState,
  stringifySavedNutritionState,
  upsertWeightEntry,
  withDayLogs,
  wouldDropOldestDay,
} from "../app/local-nutrition-state";
import { recentDayKeys, resolveLoggedFood, summariseDay, summariseHistory, summariseTrend } from "../app/day-history";
import { nutritionItems } from "../app/nutrition-data";
import { userMealToNutritionItem, type UserMeal } from "../app/logging-session";
import { scaleNutritionForUnit } from "../app/prototype-logic";

const milk = { foodId: "nandini-goodlife-toned", amount: 200 };
const egg = { foodId: "whole-egg", amount: 2 };

function storedFood(overrides: Partial<(typeof nutritionItems)[number]> = {}) {
  return {
    id: "stored-food",
    name: "Stored food",
    brand: "Stored brand",
    variant: "",
    amount: 100,
    unit: "g" as const,
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiber: 2,
    category: "Product" as const,
    availability: "Added by you",
    aliases: [],
    source: { label: "Added by you", url: "", trust: "Personal" as const },
    ...overrides,
  };
}

test("REGRESSION: a day's diary survives the next Bangalore day", () => {
  // Schema 1 kept one day inline. On rollover the app declined to restore it and then
  // autosaved the new empty day over the same key, destroying the diary every midnight.
  let state = withDayLogs(emptyNutritionState(), "2026-08-10", [milk, egg]);
  // Tuesday opens: today is empty, which is correct.
  assert.deepEqual(logsForDay(state, "2026-08-11"), []);
  // Tuesday's first log writes only Tuesday.
  state = withDayLogs(state, "2026-08-11", [milk]);
  assert.deepEqual(logsForDay(state, "2026-08-10"), [milk, egg], "Monday must still be there");
  assert.deepEqual(logsForDay(state, "2026-08-11"), [milk]);
  // And it survives a full save/reload cycle.
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));
  assert.deepEqual(logsForDay(reloaded, "2026-08-10"), [milk, egg]);
  assert.equal(reloaded.days.length, 2);
});

test("a schema 1 diary is migrated, not discarded", () => {
  const legacy = JSON.stringify({ dayKey: "2026-08-09", logs: [milk, egg], planned: [{ id: "chia", kind: "food" }] });
  const migrated = parseSavedNutritionState(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(logsForDay(migrated, "2026-08-09"), [milk, egg], "the existing day must carry over");
  assert.deepEqual(migrated.planned, [{ id: "chia", kind: "food" }]);
  assert.equal(migrated.targets, null);
});

test("stored days are newest first, deduplicated, and capped", () => {
  let state = emptyNutritionState();
  for (let index = 0; index < MAX_STORED_DAYS + 5; index += 1) {
    const day = new Date(Date.UTC(2025, 0, 1) + index * 86400000).toISOString().slice(0, 10);
    state = withDayLogs(state, day, [milk]);
  }
  assert.equal(state.days.length, MAX_STORED_DAYS, "storage must be bounded");
  assert.ok(state.days[0].dayKey > state.days[1].dayKey, "newest first");
  const keys = state.days.map((day) => day.dayKey);
  assert.equal(new Set(keys).size, keys.length, "no duplicate days");
  assert.equal(wouldDropOldestDay(state, "2030-01-01"), true, "a brand new day at the cap must warn");
  assert.equal(wouldDropOldestDay(state, state.days[0].dayKey), false, "rewriting an existing day drops nothing");
});

test("clearing a day removes it rather than recording a zero-calorie day", () => {
  let state = withDayLogs(emptyNutritionState(), "2026-08-10", [milk]);
  state = withDayLogs(state, "2026-08-10", []);
  assert.equal(state.days.length, 0, "an emptied day must not linger as a fast");
  assert.deepEqual(summariseHistory(state.days), []);
});

test("corrupt or hostile stored data degrades to an empty diary instead of throwing", () => {
  for (const raw of ["{not json", "null", "[]", '{"schemaVersion":2}', '{"schemaVersion":2,"days":"nope"}', '{"schemaVersion":2,"days":[{"dayKey":"oops","logs":[]}]}']) {
    const parsed = parseSavedNutritionState(raw);
    assert.equal(parsed.schemaVersion, 2, raw);
    assert.ok(Array.isArray(parsed.days), raw);
  }
  // Individual bad entries are dropped without taking the day with them.
  const mixed = parseSavedNutritionState(JSON.stringify({
    schemaVersion: 2,
    days: [{ dayKey: "2026-08-10", logs: [milk, { foodId: "", amount: 5 }, { foodId: "x", amount: -1 }, { foodId: "y", amount: "3" }] }],
    planned: [{ id: "chia", kind: "nope" }],
    targets: { calories: 0, protein: 10, carbs: 10, fat: 10 },
  }));
  assert.deepEqual(logsForDay(mixed, "2026-08-10"), [milk]);
  assert.deepEqual(mixed.planned, []);
  assert.equal(mixed.targets, null, "a zero calorie target is not a usable target");
});

test("a day's totals are the sum of what was actually logged", () => {
  const summary = summariseDay({ dayKey: "2026-08-10", logs: [milk, egg] });
  const milkFood = nutritionItems.find((food) => food.id === "nandini-goodlife-toned")!;
  const eggFood = nutritionItems.find((food) => food.id === "whole-egg")!;
  assert.equal(summary.calories, Math.round((milkFood.calories * 2 + eggFood.calories * 2) * 100) / 100);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.unresolvedCount, 0);
  assert.equal(summary.fiberUnknownEntries, 0);
});

test("an undeclared fibre panel stays unknown in day and trend summaries", () => {
  const day = summariseDay({ dayKey: "2026-08-10", logs: [{ foodId: "bambino-vermicelli", amount: 100 }] });
  assert.equal(day.fiber, 0, "the known subtotal remains numeric for arithmetic");
  assert.equal(day.fiberUnknownEntries, 1, "zero must not be presented as a declared fibre value");
  const trend = summariseTrend([day], 7, 2000);
  assert.equal(trend.fiberUnknownDays, 1);
  assert.equal(trend.average?.fiber, 0);
});

test("an entry naming a food that no longer exists is counted as unresolved, not as zero", () => {
  const summary = summariseDay({ dayKey: "2026-08-10", logs: [milk, { foodId: "deleted-food", amount: 100 }] });
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.unresolvedCount, 1, "the day must admit it is incomplete rather than quietly shrinking");
  assert.ok(summary.calories > 0);
});

test("trend averages use logged days only, never calendar days", () => {
  // Three logged days inside a 30 day window. Dividing by 30 would invent 27 fasts.
  const days = [
    { dayKey: "2026-08-10", logs: [milk, egg] },
    { dayKey: "2026-08-08", logs: [milk] },
    { dayKey: "2026-08-01", logs: [egg] },
  ];
  const summaries = summariseHistory(days);
  const window = summariseTrend(summaries, 30, 2000);
  assert.equal(window.loggedDays, 3);
  assert.equal(window.windowDays, 30);
  const expected = Math.round((summaries.reduce((sum, day) => sum + day.calories, 0) / 3) * 100) / 100;
  assert.equal(window.average?.calories, expected, "average must divide by 3, not by 30");
});

test("an empty window reports nothing rather than a zero average", () => {
  const window = summariseTrend([], 30, 2000);
  assert.equal(window.average, null, "no data must never render as 0 kcal per day");
  assert.equal(window.loggedDays, 0);
  assert.equal(window.daysOnTarget, null);
  // A day with entries that all failed to resolve is not a logged day either.
  const ghost = summariseHistory([{ dayKey: "2026-08-10", logs: [{ foodId: "gone", amount: 1 }] }]);
  assert.equal(summariseTrend(ghost, 7, 2000).average, null);
});

test("days on target respect the tolerance and need a target to exist", () => {
  const days = [
    { dayKey: "2026-08-10", logs: [{ foodId: "nandini-goodlife-toned", amount: 3333 }] },
    { dayKey: "2026-08-09", logs: [{ foodId: "nandini-goodlife-toned", amount: 100 }] },
  ];
  const summaries = summariseHistory(days);
  const target = summaries[0].calories;
  assert.equal(summariseTrend(summaries, 7, target).daysOnTarget, 1, "only the day near the target counts");
  assert.equal(summariseTrend(summaries, 7, null).daysOnTarget, null, "without a target there is nothing to be on");
});

test("recent day keys walk backwards across month and year boundaries", () => {
  assert.deepEqual(recentDayKeys("2026-03-02", 4), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  assert.deepEqual(recentDayKeys("2027-01-01", 2), ["2026-12-31", "2027-01-01"]);
  // 2028 is a leap year, so February has a 29th.
  assert.deepEqual(recentDayKeys("2028-03-01", 2), ["2028-02-29", "2028-03-01"]);
  assert.deepEqual(recentDayKeys("2026-08-10", 1), ["2026-08-10"]);
  assert.deepEqual(recentDayKeys("not-a-date", 3), []);
  assert.deepEqual(recentDayKeys("2026-08-10", 0), []);
});

test("failure injection: a single-day store would fail the midnight regression", () => {
  // Models the old behaviour: one day held inline, overwritten on rollover.
  const singleDay = (dayKey: string, logs: typeof milk[]) => ({ dayKey, logs });
  let legacy = singleDay("2026-08-10", [milk, egg]);
  legacy = singleDay("2026-08-11", []);
  assert.equal(legacy.dayKey === "2026-08-10", false);
  assert.deepEqual(legacy.logs, [], "the old model really did lose the day, which is what the regression above guards");
});

test("KP can always correct a prefilled name and macros, for any food", () => {
  const override = { name: "Amma's chicken curry", calories: 410, protein: 34, carbs: 12, fat: 22, fiber: 3 };
  const entry = { foodId: "composite:chicken-sabzi", amount: 1, override };
  const food = resolveLoggedFood(entry, nutritionItems);
  assert.ok(food);
  assert.equal(food.name, "Amma's chicken curry", "the typed name must win");
  assert.equal(food.calories, 410);
  assert.equal(food.protein, 34);
  assert.equal(food.carbs, 12);
  assert.equal(food.fat, 22);
  assert.equal(food.fiber, 3);
  assert.equal(food.source.trust, "Estimated", "an edited entry must never be mistaken for a researched value");
});

test("an override without a new name keeps the original food's name", () => {
  const entry = { foodId: "nandini-goodlife-toned", amount: 250, override: { calories: 200, protein: 10, carbs: 15, fat: 8, fiber: 0 } };
  const food = resolveLoggedFood(entry, nutritionItems);
  assert.ok(food);
  assert.equal(food.name, "GoodLife UHT toned milk", "no rename typed, so the catalogue name is kept");
  assert.equal(food.calories, 200, "but the corrected macros still win");
});

test("failure injection: an override must never be scaled again by amount", () => {
  // If resolveLoggedFood ever ran the override through scaleNutrition the way a catalogue
  // food is, a 1370 kcal correction logged as "3 servings" would silently become 4110 kcal.
  // KP's typed number is already the final total for the entry, whatever the quantity says.
  const entry = { foodId: "meal-tandoori-quinoa", amount: 3, override: { calories: 1370, protein: 90, carbs: 40, fat: 30, fiber: 5 } };
  const food = resolveLoggedFood(entry, nutritionItems);
  assert.ok(food);
  assert.equal(food.calories, 1370, "must equal the typed number exactly, not 3x it");
  assert.equal(food.amount, 3, "the amount is still recorded, just no longer used to compute the macros");
});

test("an override on an unknown or removed food still resolves from the numbers alone", () => {
  const food = resolveLoggedFood({ foodId: "some-deleted-id", amount: 1, override: { name: "Leftover biryani", calories: 550, protein: 20, carbs: 70, fat: 18, fiber: 2 } }, nutritionItems);
  assert.ok(food, "a corrected entry must not become unresolved just because its base food is gone");
  assert.equal(food.name, "Leftover biryani");
  assert.equal(food.calories, 550);
});

test("a corrupt or hostile override is dropped, falling back to the catalogue rather than losing the entry", () => {
  const badOverrides = [
    { calories: -5, protein: 10, carbs: 10, fat: 10, fiber: 0 },
    { calories: Number.NaN, protein: 10, carbs: 10, fat: 10, fiber: 0 },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    "not an object",
    null,
  ];
  for (const override of badOverrides) {
    const state = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [{ dayKey: "2026-08-10", logs: [{ foodId: "nandini-goodlife-toned", amount: 200, override }] }], planned: [], targets: null }));
    const logs = logsForDay(state, "2026-08-10");
    assert.equal(logs.length, 1, `entry must survive a corrupt override: ${JSON.stringify(override)}`);
    assert.equal(logs[0].override, undefined, `a corrupt override must not be saved: ${JSON.stringify(override)}`);
  }
});

test("an override survives a save and reload exactly, including a rename", () => {
  const override = { name: "Office canteen thali", calories: 640, protein: 22, carbs: 88, fat: 20, fiber: 6 };
  const state = withDayLogs(emptyNutritionState(), "2026-08-10", [{ foodId: "meal-tandoori-quinoa", amount: 1, override }]);
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));
  assert.deepEqual(logsForDay(reloaded, "2026-08-10")[0].override, override);
});

test("when raw storage carries both components and an override, the override wins and components are dropped", () => {
  const raw = JSON.stringify({
    schemaVersion: 2,
    days: [{ dayKey: "2026-08-10", logs: [{
      foodId: "composite:chapati",
      amount: 1,
      components: [{ foodId: "atta-whole-wheat", amount: 40 }],
      override: { name: "Thick chapati", calories: 200, protein: 8, carbs: 40, fat: 2, fiber: 5 },
    }] }],
    planned: [],
    targets: null,
  });
  const logs = logsForDay(parseSavedNutritionState(raw), "2026-08-10");
  assert.equal(logs[0].override?.name, "Thick chapati");
  assert.equal(logs[0].components, undefined, "components must not survive alongside an override — the two would silently disagree");
});

test("an edited entry's calories reach the day and trend totals correctly", () => {
  const day = { dayKey: "2026-08-10", logs: [{ foodId: "whole-egg", amount: 2, override: { name: "Two boiled eggs, my count", calories: 155, protein: 13, carbs: 1, fat: 11, fiber: 0 } }] };
  const summary = summariseDay(day);
  assert.equal(summary.calories, 155);
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.unresolvedCount, 0);
});

test("alternate-unit snapshots preserve the visible amount and exact historical totals", () => {
  const catalogMilk = nutritionItems.find((food) => food.id === "nandini-goodlife-toned");
  assert.ok(catalogMilk);
  const halfPack = scaleNutritionForUnit(catalogMilk, 0.5, "pack");
  const state = withDayLogs(emptyNutritionState(), "2026-08-12", [{ foodId: catalogMilk.id, amount: 0.5, snapshot: halfPack }]);
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));
  const saved = logsForDay(reloaded, "2026-08-12")[0].snapshot;
  assert.equal(saved?.amount, 0.5);
  assert.equal(saved?.unit, "pack");
  assert.equal(saved?.basis?.unit, "ml");
  assert.equal(saved?.calories, 300);
  assert.equal(summariseDay(reloaded.days[0]).calories, 300);
});

test("a grouped Meal survives reload as one row with expandable component snapshots", () => {
  const component = nutritionItems.find((food) => food.id === "whole-egg");
  assert.ok(component);
  const meal: UserMeal = { id: "usermeal-eggs", name: "Egg breakfast", createdAt: "2026-08-14", components: [{ ...component }] };
  const snapshot = userMealToNutritionItem(meal);
  const state = withDayLogs(emptyNutritionState(), "2026-08-14", [{ foodId: snapshot.id, amount: 1, snapshot, mealSnapshot: meal }]);
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));
  const entry = logsForDay(reloaded, "2026-08-14")[0];
  assert.equal(entry.snapshot?.name, "Egg breakfast");
  assert.equal(entry.mealSnapshot?.components.length, 1);
  assert.equal(summariseDay(reloaded.days[0]).entryCount, 1, "a Meal must count as one diary row, not one row per item");
});

test("corrupt Meal expansion data is dropped without losing the trustworthy aggregate row", () => {
  const component = nutritionItems.find((food) => food.id === "whole-egg");
  assert.ok(component);
  const meal: UserMeal = { id: "usermeal-eggs", name: "Egg breakfast", createdAt: "2026-08-14", components: [{ ...component }] };
  const snapshot = { ...userMealToNutritionItem(meal), calories: userMealToNutritionItem(meal).calories + 100 };
  const raw = JSON.stringify({ schemaVersion: 2, days: [{ dayKey: "2026-08-14", logs: [{ foodId: snapshot.id, amount: 1, snapshot, mealSnapshot: meal }] }], planned: [], targets: null, customFoods: [], userMeals: [], weights: [] });
  const entry = logsForDay(parseSavedNutritionState(raw), "2026-08-14")[0];
  assert.equal(entry.snapshot?.calories, snapshot.calories, "the immutable diary total remains authoritative");
  assert.equal(entry.mealSnapshot, undefined, "the contradictory expansion must not be shown");
});

test("a Meal expansion must describe the exact one-serving aggregate row", () => {
  const meal: UserMeal = { id: "usermeal-a", name: "Breakfast", createdAt: "2026-08-14", components: [storedFood()] };
  const snapshot = userMealToNutritionItem(meal);
  const contradictions = [
    { snapshot, amount: 1, mealSnapshot: { ...meal, id: "usermeal-b" } },
    { snapshot, amount: 1, mealSnapshot: { ...meal, name: "Different meal" } },
    { snapshot: { ...snapshot, category: "Product" as const }, amount: 1, mealSnapshot: meal },
    { snapshot, amount: 2, mealSnapshot: meal },
  ];
  for (const contradiction of contradictions) {
    const raw = JSON.stringify({ schemaVersion: 2, days: [{ dayKey: "2026-08-14", logs: [{ foodId: snapshot.id, ...contradiction }] }], planned: [], targets: null, customFoods: [], userMeals: [], weights: [] });
    const entry = logsForDay(parseSavedNutritionState(raw), "2026-08-14")[0];
    assert.ok(entry.snapshot, "the aggregate diary row remains usable");
    assert.equal(entry.mealSnapshot, undefined, "contradictory expansion data must be ignored");
  }
});

test("empty Meal expansion data is ignored without dropping the aggregate row", () => {
  const meal: UserMeal = { id: "usermeal-empty", name: "Empty expansion", createdAt: "2026-08-14", components: [storedFood()] };
  const snapshot = userMealToNutritionItem(meal);
  const raw = JSON.stringify({ schemaVersion: 2, days: [{ dayKey: "2026-08-14", logs: [{ foodId: snapshot.id, amount: 1, snapshot, mealSnapshot: { ...meal, components: [] } }] }], planned: [], targets: null, customFoods: [], userMeals: [], weights: [] });
  const entry = logsForDay(parseSavedNutritionState(raw), "2026-08-14")[0];
  assert.ok(entry.snapshot);
  assert.equal(entry.mealSnapshot, undefined);
});

test("stored foods obey the exact quantity limit for every unit", () => {
  const impossible = [
    storedFood({ id: "too-many-grams", unit: "g", amount: 5000.01 }),
    storedFood({ id: "too-many-ml", unit: "ml", amount: 5000.01 }),
    storedFood({ id: "too-many-scoops", unit: "scoop", amount: 10.01 }),
    storedFood({ id: "too-many-packs", unit: "pack", amount: 20.01 }),
    storedFood({ id: "too-many-pieces", unit: "piece", amount: 50.01 }),
    storedFood({ id: "too-many-servings", unit: "serving", amount: 20.01 }),
  ];
  const state = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: impossible, userMeals: [], weights: [] }));
  assert.deepEqual(state.customFoods, []);
});

test("saved Meal deduplication happens before the 200-Meal cap", () => {
  const repeated: UserMeal = { id: "usermeal-a", name: "Repeated", createdAt: "2026-08-14", components: [storedFood()] };
  const distinct: UserMeal = { id: "usermeal-b", name: "Distinct", createdAt: "2026-08-14", components: [storedFood({ id: "food-b" })] };
  const raw = JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [], userMeals: [...Array.from({ length: 200 }, () => repeated), distinct], weights: [] });
  const state = parseSavedNutritionState(raw);
  assert.deepEqual(state.userMeals.map((meal) => meal.id), ["usermeal-a", "usermeal-b"]);
});

test("a forged Meal with impossible aggregate nutrition is dropped on reload", () => {
  const meal: UserMeal = {
    id: "usermeal-too-large",
    name: "Too large",
    createdAt: "2026-08-14",
    components: Array.from({ length: 40 }, (_, index) => storedFood({ id: `large-${index}`, calories: 2000 })),
  };
  const state = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [], userMeals: [meal], weights: [] }));
  assert.deepEqual(state.userMeals, []);
});

test("commercial custom foods require a brand and survive reload without changing their macros", () => {
  const valid = { ...nutritionItems[0], id: "my-milk", brand: "My Dairy", name: "Slim Milk", variant: "100 ml", source: { label: "Edited by you", url: "", trust: "Personal" as const } };
  const accepted = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [valid], weights: [] }));
  assert.equal(accepted.customFoods[0].id, "my-milk");
  assert.equal(accepted.customFoods[0].calories, valid.calories);
  const rejected = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [{ ...valid, brand: "" }], weights: [] }));
  assert.deepEqual(rejected.customFoods, []);
  const orderedFood = { ...valid, id: "subway-paneer", brand: "Subway", name: "Paneer tikka sub", category: "OrderedFood" as const };
  const orderedAccepted = parseSavedNutritionState(JSON.stringify({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [orderedFood], userMeals: [], weights: [] }));
  assert.equal(orderedAccepted.customFoods[0].category, "OrderedFood");
});

test("weight logs validate bounds, replace same-day entries, sort, and chart safely", () => {
  let entries = upsertWeightEntry([], { date: "2026-08-10", kg: 72.04 });
  entries = upsertWeightEntry(entries, { date: "2026-08-12", kg: 71.8 });
  entries = upsertWeightEntry(entries, { date: "2026-08-10", kg: 71.9 });
  assert.deepEqual(entries, [{ date: "2026-08-10", kg: 71.9 }, { date: "2026-08-12", kg: 71.8 }]);
  assert.deepEqual(upsertWeightEntry(entries, { date: "2099-01-01", kg: 70 }), entries, "future weights must be rejected");
  assert.deepEqual(upsertWeightEntry(entries, { date: "2026-08-11", kg: 401 }), entries, "implausible weights must be rejected");
  const points = getWeightTrendPoints(entries, 300, 92);
  assert.equal(points.length, 2);
  assert.ok(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.deepEqual(getWeightTrendPoints([], 300, 92), []);
});

test("a load that discards damaged records reports how many, instead of shrinking the diary in silence", () => {
  const good = nutritionItems[0];
  const parsed = parseSavedNutritionState(JSON.stringify({
    schemaVersion: 2,
    days: [{ dayKey: "2026-08-13", logs: [{ foodId: good.id, amount: 100 }, { foodId: "", amount: 5 }] }, { dayKey: "not-a-day", logs: [] }],
    planned: [{ id: good.id, kind: "food" }, { id: "", kind: "food" }],
    customFoods: [{ ...good, id: "keeper" }, { ...good, id: "gone", brand: "" }],
    userMeals: [{ id: "", name: "broken", createdAt: "2026-08-13T00:00:00.000Z", components: [] }],
    weights: [{ date: "2026-08-13", kg: 72 }, { date: "not-a-date", kg: 72 }],
  }));

  // One damaged record in every section, each dropped rather than guessed at.
  assert.equal(parsed.customFoods.length, 1);
  assert.equal(parsed.planned.length, 1);
  assert.equal(parsed.weights.length, 1);
  assert.ok(parsed.rejected >= 5, `every discarded record must be counted, got ${parsed.rejected}`);
  assert.equal(parsed.days.length, 1, "the malformed day key is dropped");

  // The count describes one load and must never be written back into storage.
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(parsed));
  assert.equal(reloaded.rejected, 0, "a clean reload reports nothing");
  assert.equal(JSON.parse(stringifySavedNutritionState(parsed)).rejected, undefined);

  // Failure injection: intact data must not be reported as damaged.
  assert.equal(parseSavedNutritionState(stringifySavedNutritionState(emptyNutritionState())).rejected, 0);
});
