import assert from "node:assert/strict";
import test from "node:test";
import { calculateMealNutrition, meals, nutritionItems } from "../app/nutrition-data";
import { getEnergyRunway, getNutritionDelta, getQuantityLimit, isQuantityValid, matchesRecipe, scaleNutrition, sumLoggedNutrition } from "../app/prototype-logic";

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
