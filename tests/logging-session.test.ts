import assert from "node:assert/strict";
import test from "node:test";
import {
  addToTray,
  createCustomFood,
  createUserMeal,
  forkFoodForEdit,
  isCustomFoodDraftValid,
  isOwnedFood,
  isUserMealNameValid,
  MAX_MEAL_COMPONENTS,
  MAX_TRAY_ITEMS,
  makeCustomFoodId,
  mergeFoodCatalog,
  removeFromTray,
  removeUserMeal,
  slugifyFoodName,
  sumNutrition,
  trayTotals,
  upsertUserMeal,
  userMealToFoods,
  userMealTotals,
  type CustomFoodDraft,
  type TrayItem,
} from "../app/logging-session";
import { foodIconKey } from "../app/food-icon";
import { nutritionItems } from "../app/nutrition-data";
import type { NutritionItem } from "../app/nutrition-data";

function draft(overrides: Partial<CustomFoodDraft> = {}): CustomFoodDraft {
  return {
    name: "Home dahi",
    brand: "Homemade",
    variant: "",
    amount: 100,
    unit: "g",
    calories: 60,
    protein: 3.1,
    carbs: 4.7,
    fat: 3.3,
    fiber: 0,
    ...overrides,
  };
}

function food(overrides: Partial<NutritionItem> = {}): NutritionItem {
  return {
    id: "custom-test-1",
    name: "Test food",
    brand: "Test",
    variant: "",
    amount: 100,
    unit: "g",
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiber: 2,
    category: "Product",
    availability: "Added by you",
    aliases: [],
    source: { label: "Added by you", url: "", trust: "Personal" },
    ...overrides,
  };
}

test("a created food can never take over a researched catalogue entry", () => {
  const seed = nutritionItems[0];
  // Name the new food exactly like a seed item: the old flow overwrote it.
  const created = createCustomFood(draft({ name: seed.name, brand: seed.brand }), "abc123");
  assert.ok(created);
  assert.notEqual(created.id, seed.id);
  assert.ok(created.id.startsWith("custom-"));

  const merged = mergeFoodCatalog(nutritionItems, [created]);
  const seedAfter = merged.find((item) => item.id === seed.id);
  assert.deepEqual(seedAfter, seed, "the researched food must survive untouched");
  assert.equal(merged.length, nutritionItems.length + 1);
});

test("editing a researched food forks a personal copy instead of rewriting it", () => {
  const seed = nutritionItems.find((item) => item.source.trust !== "Personal");
  assert.ok(seed);
  const forked = forkFoodForEdit(seed, "xyz789");
  assert.notEqual(forked.id, seed.id);
  assert.equal(forked.source.trust, "Personal");
  assert.ok(isOwnedFood(forked));

  const merged = mergeFoodCatalog(nutritionItems, [forked]);
  assert.deepEqual(merged.find((item) => item.id === seed.id), seed);
});

test("editing a food you already own stays in place instead of piling up copies", () => {
  const owned = food({ id: "custom-home-dahi-1" });
  const forked = forkFoodForEdit(owned, "another");
  assert.equal(forked.id, owned.id);
  const merged = mergeFoodCatalog([], [owned, { ...forked, calories: 75 }]);
  assert.equal(merged.filter((item) => item.id === owned.id).length, 1);
});

test("food name slugs survive unicode, emptiness, punctuation, and absurd length", () => {
  assert.equal(slugifyFoodName("Nandini Milk"), "nandini-milk");
  assert.equal(slugifyFoodName("Café au lait"), "cafe-au-lait");
  assert.equal(slugifyFoodName("दही"), "food", "non-Latin names must still yield a usable stem");
  assert.equal(slugifyFoodName(""), "food");
  assert.equal(slugifyFoodName("   "), "food");
  assert.equal(slugifyFoodName("!!!???"), "food");
  assert.equal(slugifyFoodName("u0300 test"), "u0300-test", "plain letters and digits must not be stripped");
  const long = slugifyFoodName("a".repeat(120));
  assert.equal(long.length, 40);
  assert.doesNotMatch(slugifyFoodName("trailing dashes -----"), /-$/);
  assert.ok(makeCustomFoodId("", "1").startsWith("custom-food-"));
});

test("custom food drafts reject the values that would poison daily totals", () => {
  assert.ok(isCustomFoodDraftValid(draft()));
  assert.equal(isCustomFoodDraftValid(draft({ name: "   " })), false);
  assert.equal(isCustomFoodDraftValid(draft({ brand: "" })), false);
  assert.equal(isCustomFoodDraftValid(draft({ amount: 0 })), false);
  assert.equal(isCustomFoodDraftValid(draft({ amount: -5 })), false);
  assert.equal(isCustomFoodDraftValid(draft({ amount: 999_999 })), false);
  assert.equal(isCustomFoodDraftValid(draft({ calories: Number.NaN })), false);
  assert.equal(isCustomFoodDraftValid(draft({ protein: Number.POSITIVE_INFINITY })), false);
  assert.equal(isCustomFoodDraftValid(draft({ fat: -0.1 })), false);
  assert.equal(createCustomFood(draft({ name: "" }), "1"), null);
});

test("the tray adds, removes, totals, and refuses impossible quantities", () => {
  let tray: TrayItem[] = [];
  tray = addToTray(tray, food({ calories: 120, protein: 8, carbs: 12, fat: 4, fiber: 1 }), "a");
  tray = addToTray(tray, food({ id: "custom-b", calories: 80.005, protein: 2.004, carbs: 6, fat: 1, fiber: 0.5 }), "b");
  assert.equal(tray.length, 2);
  assert.deepEqual(trayTotals(tray), { calories: 200.01, protein: 10, carbs: 18, fat: 5, fiber: 1.5 });

  const rejected = addToTray(tray, food({ amount: 0 }), "c");
  assert.equal(rejected.length, 2, "a zero quantity must never reach the tray");
  const overLimit = addToTray(tray, food({ amount: 99_999 }), "d");
  assert.equal(overLimit.length, 2);

  const afterRemove = removeFromTray(tray, tray[0].key);
  assert.equal(afterRemove.length, 1);
  assert.equal(removeFromTray(tray, "missing-key").length, 2, "removing an unknown key must not drop entries");
  assert.deepEqual(trayTotals([]), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test("the tray stops growing at its cap instead of degrading the dialog", () => {
  let tray: TrayItem[] = [];
  for (let index = 0; index < MAX_TRAY_ITEMS + 15; index += 1) {
    tray = addToTray(tray, food({ id: `custom-${index}` }), `k${index}`);
  }
  assert.equal(tray.length, MAX_TRAY_ITEMS);
});

test("totals ignore corrupt numbers rather than rendering NaN on the dashboard", () => {
  const totals = sumNutrition([
    { calories: 100, protein: 5, carbs: 5, fat: 5, fiber: 5 },
    { calories: Number.NaN, protein: Number.POSITIVE_INFINITY, carbs: undefined, fat: 2, fiber: 1 },
  ]);
  assert.deepEqual(totals, { calories: 100, protein: 5, carbs: 5, fat: 7, fiber: 6 });
});

test("saved meals need a real name and at least one usable component", () => {
  const items: TrayItem[] = [{ key: "t1", food: food({ calories: 200, protein: 20, carbs: 10, fat: 5, fiber: 2 }) }];
  assert.equal(createUserMeal("", items, "1", "2026-08-12"), null);
  assert.equal(createUserMeal("   ", items, "1", "2026-08-12"), null);
  assert.equal(createUserMeal("a".repeat(61), items, "1", "2026-08-12"), null);
  assert.equal(createUserMeal("Breakfast", [], "1", "2026-08-12"), null);
  assert.equal(createUserMeal("Breakfast", [{ key: "t", food: food({ amount: 0 }) }], "1", "2026-08-12"), null);
  assert.ok(isUserMealNameValid("a".repeat(60)));
  assert.equal(isUserMealNameValid("a".repeat(61)), false);

  const meal = createUserMeal("  My breakfast  ", items, "u1", "2026-08-12");
  assert.ok(meal);
  assert.equal(meal.name, "My breakfast", "names are trimmed before they are stored");
  assert.ok(meal.id.startsWith("usermeal-"));
});

test("a saved meal keeps its own snapshot when the source food later changes", () => {
  const original = food({ calories: 200, protein: 20, carbs: 10, fat: 5, fiber: 2 });
  const meal = createUserMeal("Post workout", [{ key: "t1", food: original }], "u1", "2026-08-12");
  assert.ok(meal);
  original.calories = 9999;
  original.name = "Renamed later";
  assert.equal(meal.components[0].calories, 200);
  assert.equal(meal.components[0].name, "Test food");
  assert.deepEqual(userMealTotals(meal), { calories: 200, protein: 20, carbs: 10, fat: 5, fiber: 2 });
});

test("expanding a saved meal reproduces the same nutrition it was saved with", () => {
  const items: TrayItem[] = [
    { key: "t1", food: food({ id: "custom-a", amount: 200, calories: 120, protein: 6.6, carbs: 9.6, fat: 6.2, fiber: 0 }) },
    { key: "t2", food: food({ id: "custom-b", amount: 2, unit: "piece", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }) },
  ];
  const meal = createUserMeal("Breakfast", items, "u1", "2026-08-12");
  assert.ok(meal);
  const expanded = userMealToFoods(meal);
  assert.equal(expanded.length, 2);
  assert.deepEqual(sumNutrition(expanded), userMealTotals(meal));
  assert.equal(expanded[0].amount, 200);
  assert.equal(expanded[1].amount, 2);
});

test("meals cap their component count and replace rather than duplicate on save", () => {
  const many: TrayItem[] = Array.from({ length: MAX_MEAL_COMPONENTS + 10 }, (_, index) => ({
    key: `t${index}`,
    food: food({ id: `custom-${index}` }),
  }));
  const meal = createUserMeal("Huge", many, "u1", "2026-08-12");
  assert.ok(meal);
  assert.equal(meal.components.length, MAX_MEAL_COMPONENTS);

  const renamed = { ...meal, name: "Huge v2" };
  const list = upsertUserMeal(upsertUserMeal([], meal), renamed);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "Huge v2");
  assert.equal(removeUserMeal(list, meal.id).length, 0);
  assert.equal(removeUserMeal(list, "nope").length, 1);
});

test("thumbnail icons resolve compound names to the right food group", () => {
  const pick = (name: string, brand = "Brand", category: NutritionItem["category"] = "Product") =>
    foodIconKey({ name, brand, category, aliases: [] });

  // These read as one group but contain another group's keyword.
  assert.equal(pick("High Protein Buttermilk", "Amul"), "dairy");
  assert.equal(pick("Butter chicken"), "meat");
  assert.equal(pick("Peanut butter"), "nut");
  assert.equal(pick("Coconut oil"), "oil");

  assert.equal(pick("GoodLife UHT toned milk", "Nandini"), "dairy");
  assert.equal(pick("Biozyme Whey", "MuscleBlaze"), "supplement");
  assert.equal(pick("Boiled egg"), "egg");
  assert.equal(pick("Rajma"), "legume");
  assert.equal(pick("Basmati rice"), "grain");
  assert.equal(pick("Palak"), "vegetable");
  assert.equal(pick("Banana"), "fruit");
  assert.equal(pick("Something unrecognisable"), "generic", "an unknown food still gets an icon, never a blank box");
  assert.equal(pick("Anything", "Brand", "Meal"), "meal");
});

test("icon keywords match whole words, not fragments hiding inside longer ones", () => {
  const pick = (name: string) => foodIconKey({ name, brand: "Brand", category: "Product", aliases: [] });

  // Every one of these was mis-classified by plain substring matching.
  assert.equal(pick("Boiled egg"), "egg", "'boiled' contains 'oil'");
  assert.equal(pick("Eggplant curry"), "vegetable", "'eggplant' contains 'egg'");
  assert.equal(pick("Steamed idli"), "grain", "'steamed' contains 'tea'");
  assert.notEqual(pick("Until further notice"), "nut", "'until' contains 'til'");
  assert.notEqual(pick("Spoiled leftovers"), "oil", "'spoiled' contains 'oil'");
  assert.notEqual(pick("Goats cheese"), "grain", "'goats' contains 'oats'");

  // Plurals still resolve to the same group.
  assert.equal(pick("Almonds"), "nut");
  assert.equal(pick("Eggs"), "egg");
});







