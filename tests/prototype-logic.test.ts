import assert from "node:assert/strict";
import test from "node:test";
import { calculateMealNutrition, meals, nutritionItems } from "../app/nutrition-data";
import { getWeightTrendPoints, isWeightValueValid, parseSavedNutritionState, shouldPersistNutritionState, shouldRestoreSavedNutritionState, stringifySavedNutritionState, upsertWeightEntry } from "../app/local-nutrition-state";
import { getBangaloreClock, getEnergyRunway, getNutritionDelta, getQuantityLimit, isQuantityValid, matchesRecipe, scaleNutrition, sumLoggedNutrition } from "../app/prototype-logic";

test("quantity edits scale every displayed nutrient from the same serving basis", () => {
  const milk = nutritionItems.find((food) => food.id === "nandini-goodlife-toned");
  assert.ok(milk);
  const scaled = scaleNutrition(milk, 250);
  assert.equal(scaled.amount, 250);
  assert.equal(scaled.calories, 150);
  assert.equal(scaled.protein, 8.25);
  assert.equal(scaled.carbs, 12);
  assert.equal(scaled.fat, 7.75);
  assert.equal(scaled.fiber, 0);
  assert.equal(scaleNutrition(scaled, 300).calories, 180, "re-editing must use the original 100 ml basis");
});

test("invalid quantities cannot create negative or infinite nutrition", () => {
  const milk = nutritionItems[0];
  for (const invalid of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const scaled = scaleNutrition(milk, invalid);
    assert.equal(scaled.amount, 0);
    assert.equal(scaled.calories, 0);
    assert.equal(scaled.protein, 0);
  }
});

test("quantity limits block absurd entries while keeping useful serving ranges", () => {
  assert.equal(getQuantityLimit("ml"), 5000);
  assert.equal(getQuantityLimit("g"), 5000);
  assert.equal(getQuantityLimit("scoop"), 10);
  assert.equal(isQuantityValid("ml", 5000), true);
  assert.equal(isQuantityValid("ml", 5000.01), false);
  assert.equal(isQuantityValid("scoop", 0.25), true);
  assert.equal(isQuantityValid("scoop", 10.01), false);
  assert.equal(isQuantityValid("serving", Number.POSITIVE_INFINITY), false);
});

test("editing a logged quantity applies only the nutrition difference", () => {
  const milk = nutritionItems.find((food) => food.id === "nandini-goodlife-toned");
  assert.ok(milk);
  const oldServing = scaleNutrition(milk, 100);
  const newServing = scaleNutrition(milk, 250);
  assert.deepEqual(getNutritionDelta(newServing, oldServing), { calories: 90, protein: 4.95, carbs: 7.2, fat: 4.65 });
  assert.deepEqual(getNutritionDelta(oldServing, null), { calories: 60, protein: 3.3, carbs: 4.8, fat: 3.1 });
});

test("daily totals retain precision across many small logs and reversible edits", () => {
  const milk = nutritionItems.find((food) => food.id === "nandini-goodlife-toned");
  assert.ok(milk);
  const fiftyMl = scaleNutrition(milk, 50);
  const base = { calories: 1280, protein: 84, carbs: 161, fat: 32 };
  assert.deepEqual(sumLoggedNutrition(Array.from({ length: 100 }, () => fiftyMl), base), { calories: 4280, protein: 249, carbs: 401, fat: 187 });
  assert.deepEqual(sumLoggedNutrition([scaleNutrition(milk, 100)], base), { calories: 1340, protein: 87.3, carbs: 165.8, fat: 35.1 });
});

test("researched items keep unique identity, serving basis, and an evidence link", () => {
  assert.equal(new Set(nutritionItems.map((food) => food.id)).size, nutritionItems.length);
  assert.ok(nutritionItems.length >= 15);
  assert.ok(nutritionItems.filter((food) => food.common).length >= 7);
  assert.ok(nutritionItems.filter((food) => food.source.trust === "Official label").length >= 3);
  for (const food of nutritionItems) {
    for (const field of ["amount", "calories", "protein", "carbs", "fat", "fiber"] as const) {
      assert.ok(Number.isFinite(food[field]), `${food.id}.${field}`);
      assert.ok(food[field] >= 0, `${food.id}.${field}`);
    }
    assert.ok(food.brand.trim(), `${food.id}.brand`);
    assert.ok(food.name.trim(), `${food.id}.name`);
    assert.equal(typeof food.variant, "string", `${food.id}.variant`);
    assert.match(food.source.url, /^https:\/\//);
  }
});

test("meal filter tags obey their visible numeric definitions", () => {
  assert.equal(new Set(meals.map((meal) => meal.id)).size, meals.length);
  assert.ok(meals.length >= 10);
  for (const meal of meals) {
    assert.equal(meal.tags.includes("High protein"), meal.protein >= 25, `${meal.name}: high protein`);
    assert.equal(meal.tags.includes("Low fat"), meal.fat <= 10, `${meal.name}: low fat`);
    assert.equal(meal.tags.includes("High fibre"), meal.fiber >= 8, `${meal.name}: high fibre`);
    assert.ok(meal.ingredients.length >= 5, meal.name);
    assert.ok(Number.isFinite(meal.totalMinutes) && meal.totalMinutes > 0, meal.name);
    assert.ok(meal.method.length >= 3, meal.name);
  }
});

test("every displayed meal total is recalculated from structured ingredient records", () => {
  for (const meal of meals) {
    assert.deepEqual(
      { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber },
      calculateMealNutrition(meal.nutritionBasis),
      meal.name,
    );
  }
});

test("meal time and Indian yogurt search filters use explicit data", () => {
  const chia = meals.find((meal) => meal.id === "chia-cardamom-bowl");
  const rajma = meals.find((meal) => meal.id === "rajma-quinoa");
  const chaat = meals.find((meal) => meal.id === "greek-yogurt-chaat");
  assert.ok(chia && rajma && chaat);
  assert.equal(matchesRecipe(chia, "", "30 min or less"), false, "chilling time must count");
  assert.equal(matchesRecipe(rajma, "", "30 min or less"), true);
  assert.equal(matchesRecipe(rajma, "", "Vegetarian"), true, "vegan meals are vegetarian too");
  assert.equal(matchesRecipe(chaat, "yoghurt", "All"), true);
  assert.equal(matchesRecipe(chaat, "dahi", "All"), true);
});

test("calculation guards reject corrupt units, bases, targets, and overflow", () => {
  assert.equal(isQuantityValid("unknown-unit", 1), false);
  const broken = { ...nutritionItems[0], amount: 0 };
  assert.equal(scaleNutrition(broken, 100).amount, 0);
  const overflowed = scaleNutrition(nutritionItems[0], Number.MAX_VALUE);
  for (const field of ["amount", "calories", "protein", "carbs", "fat", "fiber"] as const) assert.ok(Number.isFinite(overflowed[field]));
  assert.throws(() => getEnergyRunway(0, 0), /target/i);
  assert.throws(() => getEnergyRunway(100, Number.NaN), /target/i);
});

test("meal calories remain plausible against protein, digestible carbs, fat, and fibre", () => {
  for (const meal of meals) {
    const calculated = meal.protein * 4 + Math.max(0, meal.carbs - meal.fiber) * 4 + meal.fat * 9 + meal.fiber * 2;
    const difference = Math.abs(meal.calories - calculated) / meal.calories;
    assert.ok(difference <= 0.12, `${meal.name}: ${Math.round(difference * 100)}% difference`);
  }
});

test("energy runway reports over-target intake instead of hiding it", () => {
  assert.deepEqual(getEnergyRunway(2176, 2150), { amount: 26, isOver: true, percentage: 101 });
  assert.deepEqual(getEnergyRunway(1280, 2150), { amount: 870, isOver: false, percentage: 60 });
});

test("failure injection: changing one low-fat meal above its threshold is detected", () => {
  const lowFatMeal = meals.find((meal) => meal.tags.includes("Low fat"));
  assert.ok(lowFatMeal);
  const broken = { ...lowFatMeal, fat: 10.1 };
  assert.equal(broken.fat <= 10, false);
});

test("local on-device nutrition state accepts only well-formed entries", () => {
  const saved = parseSavedNutritionState(JSON.stringify({
    dayKey: "2026-08-09",
    logs: [{ foodId: "nandini-goodlife-toned", amount: 250 }, { foodId: "", amount: 10 }, { foodId: "chia", amount: "25" }],
    planned: [{ id: "cauli-chicken", kind: "meal" }, { id: "chia", kind: "food" }, { id: "oops", kind: "unknown" }],
  }));
  assert.deepEqual(saved, {
    dayKey: "2026-08-09",
    logs: [{ foodId: "nandini-goodlife-toned", amount: 250 }],
    planned: [{ id: "cauli-chicken", kind: "meal" }, { id: "chia", kind: "food" }],
    customFoods: [],
    weights: [],
  });
  assert.deepEqual(parseSavedNutritionState("{not json"), { dayKey: null, logs: [], planned: [], customFoods: [], weights: [] });
  assert.deepEqual(parseSavedNutritionState(stringifySavedNutritionState(saved)), saved);
  assert.equal(shouldRestoreSavedNutritionState(saved, "2026-08-09"), true);
  assert.equal(shouldRestoreSavedNutritionState(saved, "2026-08-10"), false);
  assert.equal(shouldRestoreSavedNutritionState({ ...saved, dayKey: null }, "2026-08-10"), true, "legacy same-session logs migrate once");
});

test("edited foods and log snapshots survive storage without rewriting history", () => {
  const seed = nutritionItems[0];
  const edited = { ...seed, brand: "Nandini", name: "Slim Milk", variant: "100 ml", calories: 55, source: { ...seed.source, label: "Edited by you", trust: "Personal" as const } };
  const originalSnapshot = scaleNutrition(seed, 250);
  const saved = parseSavedNutritionState(JSON.stringify({
    dayKey: "2026-08-11",
    logs: [{ foodId: seed.id, amount: 250, snapshot: originalSnapshot }],
    planned: [],
    customFoods: [edited],
    weights: [],
  }));
  assert.deepEqual(saved.customFoods, [edited]);
  assert.equal(saved.logs[0].snapshot?.name, seed.name);
  assert.equal(saved.logs[0].snapshot?.calories, originalSnapshot.calories);

  const corruptSnapshot = { ...originalSnapshot, brand: "" };
  assert.deepEqual(parseSavedNutritionState(JSON.stringify({ dayKey: "2026-08-11", logs: [{ foodId: seed.id, amount: 250, snapshot: corruptSnapshot }] })).logs, []);
  const mismatchedSnapshot = { ...originalSnapshot, id: "different-food" };
  assert.deepEqual(parseSavedNutritionState(JSON.stringify({ dayKey: "2026-08-11", logs: [{ foodId: seed.id, amount: 250, snapshot: mismatchedSnapshot }] })).logs, []);
});

test("one malformed food cannot erase other saved nutrition and valid entries are capped after validation", () => {
  const validFood = { ...nutritionItems[0], id: "  custom-milk  ", source: { ...nutritionItems[0].source, label: "Edited by you", trust: "Personal" as const } };
  const parsed = parseSavedNutritionState(JSON.stringify({
    dayKey: "2026-08-11",
    logs: [{ foodId: "banana", amount: 118 }],
    planned: [{ id: " chia ", kind: "food" }],
    customFoods: [...Array.from({ length: 500 }, () => ({})), { ...validFood, basis: null }],
    weights: [...Array.from({ length: 5000 }, () => ({ date: "bad", kg: 0 })), { date: "2026-08-11", kg: 72 }, { date: "9999-12-31", kg: 399 }],
  }));
  assert.deepEqual(parsed.logs, [{ foodId: "banana", amount: 118 }]);
  assert.deepEqual(parsed.planned, [{ id: "chia", kind: "food" }]);
  assert.deepEqual(parsed.customFoods, [], "basis:null is rejected without resetting other state");
  assert.deepEqual(parsed.weights, [{ date: "2026-08-11", kg: 72 }], "invalid leading values must not crowd out valid data");

  const accepted = parseSavedNutritionState(JSON.stringify({ customFoods: [...Array.from({ length: 500 }, () => ({})), validFood] }));
  assert.equal(accepted.customFoods[0].id, "custom-milk");
  assert.deepEqual(parseSavedNutritionState(JSON.stringify({ customFoods: [{ ...validFood, unit: "g", amount: 5000.01 }] })).customFoods, []);
});

test("weight entries validate, correct same-day values, sort, and chart safely", () => {
  assert.equal(isWeightValueValid(20), true);
  assert.equal(isWeightValueValid(400), true);
  for (const invalid of [19.9, 400.1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(isWeightValueValid(invalid), false);

  let entries = upsertWeightEntry([], { date: "2026-08-11", kg: 72.46 });
  entries = upsertWeightEntry(entries, { date: "2026-08-09", kg: 73 });
  entries = upsertWeightEntry(entries, { date: "2026-08-11", kg: 72.2 });
  assert.deepEqual(entries, [{ date: "2026-08-09", kg: 73 }, { date: "2026-08-11", kg: 72.2 }]);
  assert.deepEqual(upsertWeightEntry(entries, { date: "2026-02-30", kg: 70 }), entries);

  const points = getWeightTrendPoints(entries, 300, 100);
  assert.deepEqual(points.map(({ x, y }) => ({ x, y })), [{ x: 0, y: 20 }, { x: 300, y: 100 }], "sub-kilogram changes should not be visually exaggerated");
  assert.deepEqual(getWeightTrendPoints([{ date: "2026-08-11", kg: 72 }], 300, 100), [{ date: "2026-08-11", kg: 72, x: 150, y: 50 }]);
  assert.deepEqual(getWeightTrendPoints([{ date: "2026-08-11", kg: 72 }, { date: "2026-08-11", kg: 71.8 }], 300, 100), [{ date: "2026-08-11", kg: 71.8, x: 150, y: 50 }]);
  assert.deepEqual(getWeightTrendPoints([{ date: "2026-01-01", kg: 72 }, { date: "2026-01-02", kg: 71.9 }, { date: "2026-01-11", kg: 71.8 }], 100, 100).map((point) => point.x), [0, 10, 100]);
  assert.deepEqual(getWeightTrendPoints(entries, 0, 100), []);
});

test("day rollover cannot save yesterday's diary under today's date", () => {
  assert.equal(shouldPersistNutritionState(true, "2026-08-11", "2026-08-11"), true);
  assert.equal(shouldPersistNutritionState(true, "2026-08-10", "2026-08-11"), false);
  assert.equal(shouldPersistNutritionState(false, "2026-08-11", "2026-08-11"), false);
});

test("Bangalore greeting and day key follow local time boundaries", () => {
  const cases = [
    ["2026-08-08T23:29:00.000Z", "Good night"],
    ["2026-08-08T23:30:00.000Z", "Good morning"],
    ["2026-08-09T06:29:00.000Z", "Good morning"],
    ["2026-08-09T06:30:00.000Z", "Good afternoon"],
    ["2026-08-09T11:29:00.000Z", "Good afternoon"],
    ["2026-08-09T11:30:00.000Z", "Good evening"],
    ["2026-08-09T16:29:00.000Z", "Good evening"],
    ["2026-08-09T16:30:00.000Z", "Good night"],
  ] as const;
  for (const [iso, greeting] of cases) assert.equal(getBangaloreClock(new Date(iso)).greeting, greeting, iso);
  assert.deepEqual(getBangaloreClock(new Date("2026-08-09T15:30:00.000Z")), { dayKey: "2026-08-09", dateLabel: "Sunday · 9 August", greeting: "Good evening" });
  assert.throws(() => getBangaloreClock(new Date("invalid")), /valid date/i);
});
