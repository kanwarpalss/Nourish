import { nutritionItems, SOURCE_LINKS, type NutritionItem } from "./nutrition-data";

export type CompositeComponent = { foodId: string; amount: number };

/**
 * A composite is an everyday dish assembled from catalogue foods, with each component
 * weight prefilled to a realistic default and individually editable.
 *
 * This exists because the two things KP eats most often — a chapati and a sabzi — have no
 * single honest number. A chapati is however much atta went into it; a chicken sabzi is
 * however much oil the cook used. Prefilling a sensible default and letting the weight be
 * corrected is more truthful than publishing one fixed calorie figure, and far faster than
 * logging every ingredient by hand.
 */
export type CompositeFood = {
  id: string;
  name: string;
  serving: string;
  note: string;
  aliases: string[];
  components: CompositeComponent[];
};

export const compositeFoods: CompositeFood[] = [
  {
    id: "chapati",
    name: "Chapati · roti",
    serving: "1 chapati",
    note: "A home chapati is usually rolled from 25–35 g of atta with no added fat. Change the atta weight to match how you actually make them.",
    aliases: ["chapati", "roti", "phulka", "atta", "wheat", "bread"],
    components: [{ foodId: "atta-whole-wheat", amount: 30 }],
  },
  {
    id: "chapati-ghee",
    name: "Chapati with ghee",
    serving: "1 chapati",
    note: "The same chapati with roughly half a teaspoon of ghee brushed on. Ghee is counted, not treated as a free food.",
    aliases: ["chapati", "roti", "ghee roti", "phulka"],
    components: [{ foodId: "atta-whole-wheat", amount: 30 }, { foodId: "oil", amount: 3 }],
  },
  {
    id: "chicken-sabzi",
    name: "Chicken sabzi · home style",
    serving: "1 serving",
    note: "Curry-cut chicken cooked with onion, tomato and measured oil. Raw chicken weight is used, which is how it is bought and weighed.",
    aliases: ["chicken sabzi", "chicken curry", "murgh", "chicken masala", "non veg"],
    components: [
      { foodId: "chicken-curry-cut-raw", amount: 150 },
      { foodId: "onion", amount: 60 },
      { foodId: "tomato", amount: 60 },
      { foodId: "oil", amount: 10 },
    ],
  },
  {
    id: "paneer-sabzi",
    name: "Paneer sabzi · home style",
    serving: "1 serving",
    note: "Paneer in an onion-tomato masala with measured oil. Swap to Amul High Protein Paneer in the components if that is the pack you used.",
    aliases: ["paneer sabzi", "paneer curry", "paneer masala", "vegetarian"],
    components: [
      { foodId: "paneer-whole-milk", amount: 100 },
      { foodId: "onion", amount: 50 },
      { foodId: "tomato", amount: 60 },
      { foodId: "oil", amount: 8 },
    ],
  },
  {
    id: "dal-tadka",
    name: "Dal tadka",
    serving: "1 katori",
    note: "Cooked toor dal with an onion-tomato tadka. The dal weight is cooked, not dry.",
    aliases: ["dal", "daal", "toor dal", "tadka", "sambar"],
    components: [
      { foodId: "toor-dal-cooked", amount: 180 },
      { foodId: "onion", amount: 25 },
      { foodId: "tomato", amount: 25 },
      { foodId: "oil", amount: 6 },
    ],
  },
  {
    id: "aloo-sabzi",
    name: "Aloo sabzi",
    serving: "1 serving",
    note: "Potato cooked with onion and measured oil.",
    aliases: ["aloo", "potato sabzi", "aloo sabzi", "vegetarian"],
    components: [
      { foodId: "potato", amount: 150 },
      { foodId: "onion", amount: 30 },
      { foodId: "oil", amount: 8 },
    ],
  },
  {
    id: "mixed-veg-sabzi",
    name: "Mixed veg sabzi",
    serving: "1 serving",
    note: "Carrot, beans and cauliflower with onion and measured oil.",
    aliases: ["sabzi", "mixed veg", "vegetable curry", "vegetarian"],
    components: [
      { foodId: "carrot", amount: 60 },
      { foodId: "green-beans", amount: 60 },
      { foodId: "cauliflower", amount: 80 },
      { foodId: "onion", amount: 30 },
      { foodId: "oil", amount: 8 },
    ],
  },
  {
    id: "egg-bhurji",
    name: "Egg bhurji",
    serving: "1 serving",
    note: "Two eggs scrambled with onion, tomato and measured oil.",
    aliases: ["egg bhurji", "anda bhurji", "scrambled egg", "egg"],
    components: [
      { foodId: "whole-egg", amount: 2 },
      { foodId: "onion", amount: 40 },
      { foodId: "tomato", amount: 40 },
      { foodId: "oil", amount: 6 },
    ],
  },
  {
    id: "curd-bowl",
    name: "Curd · 1 katori",
    serving: "1 katori",
    note: "A standard katori of set curd.",
    aliases: ["curd", "dahi", "yogurt", "katori"],
    components: [{ foodId: "curd-dahi", amount: 150 }],
  },
];

export function findComponentFood(foodId: string): NutritionItem | null {
  return nutritionItems.find((food) => food.id === foodId) ?? null;
}

/** Scales one component from its own serving basis. Unknown or invalid components add nothing. */
export function componentNutrition(component: CompositeComponent) {
  const food = findComponentFood(component.foodId);
  const empty = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (!food || !Number.isFinite(component.amount) || component.amount <= 0 || food.amount <= 0) return empty;
  const scale = component.amount / food.amount;
  if (!Number.isFinite(scale)) return empty;
  return {
    calories: food.calories * scale,
    protein: food.protein * scale,
    carbs: food.carbs * scale,
    fat: food.fat * scale,
    fiber: food.fiber * scale,
  };
}

export function sumComponents(components: CompositeComponent[]) {
  const totals = components.reduce((sum, component) => {
    const value = componentNutrition(component);
    return {
      calories: sum.calories + value.calories,
      protein: sum.protein + value.protein,
      carbs: sum.carbs + value.carbs,
      fat: sum.fat + value.fat,
      fiber: sum.fiber + value.fiber,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const round = (value: number) => Math.round(value * 100) / 100;
  return { calories: round(totals.calories), protein: round(totals.protein), carbs: round(totals.carbs), fat: round(totals.fat), fiber: round(totals.fiber) };
}

export const COMPOSITE_ID_PREFIX = "composite:";

export function compositeIdFor(composite: CompositeFood) {
  return `${COMPOSITE_ID_PREFIX}${composite.id}`;
}

export function findCompositeByLogId(logId: string): CompositeFood | null {
  if (!logId.startsWith(COMPOSITE_ID_PREFIX)) return null;
  const id = logId.slice(COMPOSITE_ID_PREFIX.length);
  return compositeFoods.find((composite) => composite.id === id) ?? null;
}

/**
 * Turns a composite plus its current component weights into a normal loggable food, so the
 * rest of the app — scaling, totals, the timeline, persistence — needs no special case.
 * One serving is the basis, so a quantity of 2 means two chapatis.
 */
export function buildCompositeItem(composite: CompositeFood, components: CompositeComponent[]): NutritionItem {
  const totals = sumComponents(components);
  const parts = components
    .map((component) => {
      const food = findComponentFood(component.foodId);
      return food ? `${food.name.split(" · ")[0]} ${component.amount}${food.unit === "piece" ? "" : food.unit}` : null;
    })
    .filter((part): part is string => part !== null);
  return {
    id: compositeIdFor(composite),
    name: composite.name,
    amount: 1,
    unit: "serving",
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    category: "Composite",
    availability: parts.join(" · ") || composite.serving,
    aliases: composite.aliases,
    components,
    source: { label: "Calculated from weighed components", url: SOURCE_LINKS.ifct, trust: "Reference" },
  };
}

/** The default, unedited version of every composite, ready to list in search results. */
export function defaultCompositeItems(): NutritionItem[] {
  return compositeFoods.map((composite) => buildCompositeItem(composite, composite.components));
}
