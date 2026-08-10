import assert from "node:assert/strict";
import test from "node:test";
import { calculateMealNutrition, meals, numericTags, nutritionItems } from "../app/nutrition-data";
import { estimateSatiety, getBangaloreClock, getEnergyRunway, getNutritionDelta, getQuantityLimit, hasNutritionTarget, isQuantityValid, matchesNutritionTarget, matchesRecipe, satietyLabel, scaleNutrition, sumLoggedNutrition } from "../app/prototype-logic";

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

test("a calorie ceiling and protein window select the right meals", () => {
  // KP's scenario: something within 500 kcal carrying 50-70 g protein.
  const target = { maxCalories: 500, minProtein: 50, maxProtein: 70 };
  const fitting = meals.filter((meal) => matchesNutritionTarget(meal, target));
  assert.ok(fitting.length > 0, "no meal fits 500 kcal with 50-70 g protein");
  for (const meal of fitting) {
    assert.ok(meal.calories <= 500, `${meal.name} is ${meal.calories} kcal`);
    assert.ok(meal.protein >= 50 && meal.protein <= 70, `${meal.name} has ${meal.protein} g protein`);
  }
  // Everything excluded must genuinely breach a bound, so nothing useful is hidden.
  for (const meal of meals.filter((meal) => !fitting.includes(meal))) {
    assert.ok(meal.calories > 500 || meal.protein < 50 || meal.protein > 70, `${meal.name} was excluded but fits`);
  }
});

test("an unset bound is ignored rather than treated as zero", () => {
  const meal = { calories: 400, protein: 30, fiber: 5 };
  assert.equal(matchesNutritionTarget(meal, {}), true);
  assert.equal(matchesNutritionTarget(meal, { maxCalories: undefined, minProtein: 25 }), true);
  assert.equal(matchesNutritionTarget(meal, { minProtein: Number.NaN }), true, "a non-numeric bound must not filter everything out");
  assert.equal(matchesNutritionTarget(meal, { maxCalories: 399 }), false);
  assert.equal(matchesNutritionTarget(meal, { minProtein: 31 }), false);
  assert.equal(matchesNutritionTarget(meal, { maxProtein: 29 }), false);
  assert.equal(matchesNutritionTarget(meal, { minFiber: 6 }), false);
  // Boundaries are inclusive: "at most 500" includes 500.
  assert.equal(matchesNutritionTarget({ calories: 500, protein: 50, fiber: 0 }, { maxCalories: 500, minProtein: 50 }), true);
  assert.equal(hasNutritionTarget({}), false);
  assert.equal(hasNutritionTarget({ maxCalories: Number.NaN }), false);
  assert.equal(hasNutritionTarget({ maxCalories: 500 }), true);
});

test("fullness ranks protein and fibre above calorie-dense foods", () => {
  const score = (id: string) => {
    const food = nutritionItems.find((item) => item.id === id);
    assert.ok(food, id);
    return estimateSatiety(food);
  };
  // Lean protein and high-fibre volume beat oil and nuts, which is the whole point.
  assert.ok(score("egg-whites") > score("almonds"), "egg whites should outrank almonds");
  assert.ok(score("greek-yogurt-nonfat") > score("peanut-butter"), "non-fat yogurt should outrank peanut butter");
  assert.ok(score("cucumber") > score("oil"), "cucumber should outrank cooking oil");
  assert.equal(score("oil"), 0, "pure fat has no protein, no fibre and maximum energy density");
  for (const food of nutritionItems) {
    const value = estimateSatiety(food);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${food.id} scored ${value}`);
  }
});

test("fullness degrades safely on corrupt or unusual foods", () => {
  assert.equal(estimateSatiety({ calories: 0, protein: 10, fiber: 5 }), 0, "zero calories cannot be scored");
  assert.equal(estimateSatiety({ calories: Number.NaN, protein: 10, fiber: 5 }), 0);
  assert.equal(estimateSatiety({ calories: -100, protein: 10, fiber: 5 }), 0);
  // Negative macros must not produce a negative or inflated score.
  const negative = estimateSatiety({ calories: 100, protein: -50, fiber: -50, amount: 100, unit: "g" });
  assert.ok(negative >= 0 && negative <= 100, `scored ${negative}`);
  // A piece/scoop serving has no computable energy density; the score must still use the
  // full 0-100 range rather than silently losing 30 points.
  const scoop = estimateSatiety({ calories: 131.68, protein: 25, fiber: 0, amount: 1, unit: "scoop" });
  assert.ok(scoop > 45, `whey scored only ${scoop}; the missing density term was not rescaled`);
  assert.equal(satietyLabel(75), "Very filling");
  assert.equal(satietyLabel(55), "Filling");
  assert.equal(satietyLabel(35), "Moderate");
  assert.equal(satietyLabel(5), "Easy to overeat");
});

test("failure injection: an unfilling food must not pass as filling", () => {
  const oil = nutritionItems.find((food) => food.id === "oil");
  assert.ok(oil);
  assert.equal(satietyLabel(estimateSatiety(oil)), "Easy to overeat");
  // If the model ever scored fat highly, this comparison would break first.
  const chicken = nutritionItems.find((food) => food.id === "chicken-breast");
  assert.ok(chicken && estimateSatiety(chicken) > estimateSatiety(oil) + 40);
});

test("numeric badges are derived from the numbers at every boundary", () => {
  // The catalogue test can only ever pass now that tags are computed, so the rule itself
  // is checked directly, including each threshold and one step either side of it.
  assert.deepEqual(numericTags({ protein: 25, fat: 10, fiber: 8 }), ["High protein", "Low fat", "High fibre"], "thresholds are inclusive");
  assert.deepEqual(numericTags({ protein: 24.9, fat: 10.1, fiber: 7.9 }), [], "just outside every rule earns nothing");
  assert.deepEqual(numericTags({ protein: 60, fat: 2, fiber: 20 }), ["High protein", "Low fat", "High fibre"]);
  assert.deepEqual(numericTags({ protein: 0, fat: 0, fiber: 0 }), ["Low fat"], "a fat-free food is low fat even with no protein");
});

test("failure injection: a badge cannot survive an ingredient change that breaks its rule", () => {
  const lowFat = meals.find((meal) => meal.tags.includes("Low fat"));
  assert.ok(lowFat);
  // Recomputing with the fat pushed over the line must drop the badge. Before badges were
  // derived, the hand-typed tag stayed and silently disagreed with the number beside it.
  assert.equal(numericTags({ protein: lowFat.protein, fat: 10.1, fiber: lowFat.fiber }).includes("Low fat"), false);
});

/**
 * Foods whose published energy legitimately disagrees with the general 4/4/9 factors.
 * USDA applies food-specific Atwater factors to cocoa, which are materially lower than the
 * general ones, so the general calculation overstates it by design.
 */
const ENERGY_CHECK_EXEMPT = new Set(["cocoa"]);

/** protein x4 + available carbs x4 + fat x9 + fibre x2, the general Atwater calculation. */
function calculatedEnergy(food: { protein: number; carbs: number; fat: number; fiber: number }) {
  return food.protein * 4 + Math.max(0, food.carbs - food.fiber) * 4 + food.fat * 9 + food.fiber * 2;
}

/**
 * A packaged product's panel is one manufacturer's own arithmetic and should agree with
 * itself closely. A raw food's published energy comes from a composition table that may use
 * food-specific factors, and low-calorie vegetables swing wildly in percentage terms over a
 * 2 kcal difference, so those get a much looser bound.
 */
function energyTolerance(food: { calories: number; source: { trust: string } }) {
  const packaged = food.source.trust === "Official label" || food.source.trust === "Label mirror";
  return packaged ? Math.max(10, food.calories * 0.1) : Math.max(15, food.calories * 0.25);
}

test("no catalogue food's calories contradict its own macros", () => {
  // This is what makes it safe to transcribe a panel found online: a value that does not
  // agree with itself never reaches KP. It is a smell test, not a precision instrument.
  const offenders: string[] = [];
  for (const food of nutritionItems) {
    if (ENERGY_CHECK_EXEMPT.has(food.id) || food.calories === 0) continue;
    const calculated = calculatedEnergy(food);
    if (Math.abs(calculated - food.calories) > energyTolerance(food)) {
      offenders.push(`${food.id} [${food.source.trust}]: states ${food.calories} kcal, macros compute to ${calculated.toFixed(1)}`);
    }
  }
  assert.deepEqual(offenders, [], `implausible catalogue entries:\n${offenders.join("\n")}`);
});

test("failure injection: bad transcribed values are caught at the tier they arrive in", () => {
  const paneer = nutritionItems.find((food) => food.id === "paneer-whole-milk");
  assert.ok(paneer);
  const passes = (food: { calories: number; protein: number; carbs: number; fat: number; fiber: number; source: { trust: string } }) =>
    Math.abs(calculatedEnergy(food) - food.calories) <= energyTolerance(food);

  assert.equal(passes(paneer), true, "the real entry must pass");
  // A dropped or added digit, the most likely transcription slip.
  assert.equal(passes({ ...paneer, calories: 29.6 }), false);
  assert.equal(passes({ ...paneer, calories: 2960 }), false);

  // The Yogabar figures found while researching: 210 kcal against macros computing to 238.5.
  // At 13.6% they clear the loose bound for raw foods but fail the packaged bound, which is
  // the tier such a value would actually arrive in. This is why it was not entered.
  const yogabar = { calories: 210, protein: 26, carbs: 28, fat: 2.5, fiber: 0 };
  assert.equal(passes({ ...yogabar, source: { trust: "Label mirror" } }), false, "a packaged panel that disagrees with itself must be rejected");
  assert.equal(passes({ ...yogabar, source: { trust: "Reference" } }), true, "and the raw-food bound is deliberately looser, which is why tier matters");
});

test("an unverified product variant does not borrow a verified one's numbers", () => {
  const ids = nutritionItems.map((food) => food.id);
  // Only the unsweetened So Good panel was confirmed; Barista and the flavoured versions
  // differ and must stay without macros rather than inherit it.
  assert.ok(ids.includes("so-good-oat-unsweetened"));
  assert.equal(nutritionItems.some((food) => food.id.includes("barista")), false);
  // Zero-sugar cola exists; full-sugar cola does not, so it cannot be matched to 0 kcal.
  const cola = nutritionItems.find((food) => food.id === "cola-zero-sugar");
  assert.ok(cola && cola.calories === 0);
});

test("every transcribed panel is marked as a mirror, never as an official label", () => {
  // A panel found online is not the pack in KP's hand, however good the source.
  for (const id of ["milkymist-greek-yogurt", "health-factory-protein-bread", "epigamia-turbo-shake", "cosmix-plant-protein", "so-good-oat-unsweetened"]) {
    const food = nutritionItems.find((item) => item.id === id);
    assert.ok(food, id);
    assert.equal(food.source.trust, "Label mirror", `${id} must not claim to be an official label`);
    assert.match(food.source.url, /^https:\/\//);
  }
});
