import assert from "node:assert/strict";
import test from "node:test";
import { buildCompositeItem, componentNutrition, compositeFoods, defaultCompositeItems, findCompositeByLogId, sumComponents } from "../app/composite-foods";
import { nutritionItems } from "../app/nutrition-data";
import { logsForDay, parseSavedNutritionState, stringifySavedNutritionState, withDayLogs, emptyNutritionState } from "../app/local-nutrition-state";
import { scaleNutrition } from "../app/prototype-logic";

const chapati = compositeFoods.find((composite) => composite.id === "chapati")!;

test("every composite component points at a real catalogue food", () => {
  for (const composite of compositeFoods) {
    assert.ok(composite.components.length > 0, `${composite.id} has no components`);
    for (const component of composite.components) {
      const food = nutritionItems.find((item) => item.id === component.foodId);
      assert.ok(food, `${composite.id} references missing food ${component.foodId}`);
      assert.ok(component.amount > 0, `${composite.id}.${component.foodId} must have a positive default`);
    }
  }
});

test("a chapati is calculated from its atta weight, not a fixed number", () => {
  const atta = nutritionItems.find((food) => food.id === "atta-whole-wheat")!;
  const built = buildCompositeItem(chapati, chapati.components);
  // 30 g of a 100 g basis is exactly 0.3 of the flour.
  assert.equal(built.calories, Math.round(atta.calories * 0.3 * 100) / 100);
  assert.equal(built.unit, "serving");
  assert.equal(built.amount, 1);
  assert.equal(built.category, "Composite");
  assert.deepEqual(built.components, chapati.components);
});

test("editing the atta weight changes the chapati proportionally", () => {
  const thin = buildCompositeItem(chapati, [{ foodId: "atta-whole-wheat", amount: 25 }]);
  const thick = buildCompositeItem(chapati, [{ foodId: "atta-whole-wheat", amount: 50 }]);
  assert.ok(thick.calories > thin.calories, "a bigger chapati must not report the same calories");
  // Exactly double the flour is exactly double everything.
  assert.equal(Math.round(thick.calories / thin.calories), 2);
  assert.equal(Math.round((thick.protein / thin.protein) * 100) / 100, 2);
  assert.equal(Math.round((thick.fiber / thin.fiber) * 100) / 100, 2);
});

test("a dish total equals the sum of its weighed parts", () => {
  const sabzi = compositeFoods.find((composite) => composite.id === "chicken-sabzi")!;
  const manual = sabzi.components.reduce((sum, component) => {
    const value = componentNutrition(component);
    return { calories: sum.calories + value.calories, protein: sum.protein + value.protein, fat: sum.fat + value.fat };
  }, { calories: 0, protein: 0, fat: 0 });
  const built = buildCompositeItem(sabzi, sabzi.components);
  assert.equal(built.calories, Math.round(manual.calories * 100) / 100);
  assert.equal(built.protein, Math.round(manual.protein * 100) / 100);
  // Cooking oil is counted, never treated as free.
  assert.ok(built.fat >= 10, `oil must be included: ${built.fat} g fat`);
});

test("logging two chapatis doubles the dish, and re-editing keeps the one-serving basis", () => {
  const built = buildCompositeItem(chapati, chapati.components);
  const two = scaleNutrition(built, 2);
  assert.equal(two.amount, 2);
  assert.equal(two.calories, Math.round(built.calories * 2 * 100) / 100);
  assert.equal(scaleNutrition(two, 3).calories, Math.round(built.calories * 3 * 100) / 100, "re-editing must scale from one serving, not from two");
});

test("an edited chapati survives a save and reload", () => {
  const edited = [{ foodId: "atta-whole-wheat", amount: 45 }];
  const built = buildCompositeItem(chapati, edited);
  const state = withDayLogs(emptyNutritionState(), "2026-08-10", [{ foodId: built.id, amount: 2, components: edited }]);

  const restored = parseSavedNutritionState(stringifySavedNutritionState(state));
  const logs = logsForDay(restored, "2026-08-10");
  assert.deepEqual(logs[0].components, edited, "the weight KP actually used must be saved");

  const composite = findCompositeByLogId(logs[0].foodId);
  assert.ok(composite);
  const rebuilt = scaleNutrition(buildCompositeItem(composite, logs[0].components!), logs[0].amount);
  assert.equal(rebuilt.calories, scaleNutrition(built, 2).calories, "reload must not fall back to the 30 g default");
});

test("failure injection: dropping saved components would silently restore the default", () => {
  const edited = [{ foodId: "atta-whole-wheat", amount: 45 }];
  const withEdit = buildCompositeItem(chapati, edited);
  const withDefault = buildCompositeItem(chapati, chapati.components);
  assert.notEqual(withEdit.calories, withDefault.calories, "if these matched, the reload test above could not detect the bug");
});

test("a corrupt or unknown component contributes nothing instead of crashing", () => {
  assert.deepEqual(componentNutrition({ foodId: "does-not-exist", amount: 100 }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  for (const amount of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(componentNutrition({ foodId: "atta-whole-wheat", amount }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, `amount ${amount}`);
  }
  assert.deepEqual(sumComponents([]), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const partial = buildCompositeItem(chapati, [{ foodId: "atta-whole-wheat", amount: 30 }, { foodId: "ghost", amount: 100 }]);
  assert.equal(partial.calories, buildCompositeItem(chapati, chapati.components).calories, "an unknown part must not inflate the total");
});

test("composite dishes are searchable by the words KP would type", () => {
  const items = defaultCompositeItems();
  const searchable = (item: (typeof items)[number]) => [item.name, ...item.aliases].join(" ").toLowerCase();
  for (const query of ["chapati", "roti", "sabzi", "dal", "curd", "bhurji"]) {
    assert.ok(items.some((item) => searchable(item).includes(query)), `nothing matches "${query}"`);
  }
  assert.ok(items.every((item) => item.id.startsWith("composite:")), "composite ids must be namespaced");
  assert.equal(findCompositeByLogId("composite:chapati")?.id, "chapati");
  assert.equal(findCompositeByLogId("atta-whole-wheat"), null, "a plain food is not a composite");
});

test("composite calories stay plausible against their own macros", () => {
  for (const item of defaultCompositeItems()) {
    const calculated = item.protein * 4 + Math.max(0, item.carbs - item.fiber) * 4 + item.fat * 9 + item.fiber * 2;
    const difference = Math.abs(item.calories - calculated) / item.calories;
    assert.ok(difference <= 0.12, `${item.name}: ${Math.round(difference * 100)}% away from its macros`);
  }
});
