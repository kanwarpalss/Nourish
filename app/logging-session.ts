import type { NutritionItem } from "./nutrition-data";
import { isQuantityValid } from "./prototype-logic";

export const CUSTOM_FOOD_PREFIX = "custom-";
export const USER_MEAL_PREFIX = "usermeal-";

export const MAX_TRAY_ITEMS = 60;
export const MAX_USER_MEALS = 200;
export const MAX_MEAL_COMPONENTS = 40;
export const MAX_MEAL_NAME_LENGTH = 60;

export type TrayItem = {
  key: string;
  food: NutritionItem;
};

export type UserMeal = {
  id: string;
  name: string;
  createdAt: string;
  components: NutritionItem[];
};

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const ZERO_TOTALS: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Turns a food name into an id-safe slug. Non-Latin names (Hindi, Kannada) slugify
 * to nothing, so callers always get a usable stem instead of a dangling prefix.
 */
export function slugifyFoodName(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "food";
}

/**
 * Ids for foods you create must never collide with a researched seed id, because
 * the catalogue merges by id: a collision silently replaces the reference food.
 */
export function makeCustomFoodId(name: string, unique: string) {
  const suffix = unique.trim() || "1";
  return `${CUSTOM_FOOD_PREFIX}${slugifyFoodName(name)}-${suffix}`;
}

export function makeUserMealId(name: string, unique: string) {
  const suffix = unique.trim() || "1";
  return `${USER_MEAL_PREFIX}${slugifyFoodName(name)}-${suffix}`;
}

export function isOwnedFood(food: Pick<NutritionItem, "id" | "source">) {
  return food.id.startsWith(CUSTOM_FOOD_PREFIX) || food.source.trust === "Personal";
}

export type CustomFoodDraft = Pick<
  NutritionItem,
  "name" | "brand" | "variant" | "amount" | "unit" | "calories" | "protein" | "carbs" | "fat" | "fiber"
> & { category?: NutritionItem["category"]; imageUrl?: string };

export function isCustomFoodDraftValid(draft: CustomFoodDraft) {
  const numbers = [draft.amount, draft.calories, draft.protein, draft.carbs, draft.fat, draft.fiber];
  return Boolean(draft.name.trim())
    && Boolean(draft.brand.trim())
    && isQuantityValid(draft.unit, draft.amount)
    && numbers.every((value) => Number.isFinite(value) && value >= 0 && value <= 50_000);
}

/**
 * Builds a brand-new food you own. Always a fresh id, so creating a food can
 * never overwrite an existing catalogue entry.
 */
export function createCustomFood(draft: CustomFoodDraft, unique: string): NutritionItem | null {
  if (!isCustomFoodDraftValid(draft)) return null;
  const name = draft.name.trim();
  return {
    id: makeCustomFoodId(name, unique),
    name,
    brand: draft.brand.trim(),
    variant: draft.variant.trim(),
    amount: draft.amount,
    unit: draft.unit,
    calories: draft.calories,
    protein: draft.protein,
    carbs: draft.carbs,
    fat: draft.fat,
    fiber: draft.fiber,
    category: draft.category ?? "Product",
    availability: "Added by you",
    aliases: [],
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    source: { label: "Added by you", url: "", trust: "Personal" },
  };
}

/**
 * Editing a researched food must not rewrite the shared reference. Foods you
 * already own edit in place; anything else forks into your own copy first.
 */
export function forkFoodForEdit(food: NutritionItem, unique: string): NutritionItem {
  if (isOwnedFood(food)) return { ...food };
  return {
    ...food,
    id: makeCustomFoodId(food.name, unique),
    availability: "Edited by you",
    source: { label: "Edited by you", url: food.source.url, trust: "Personal" },
  };
}

/**
 * Overlays foods you own onto the researched catalogue. Overrides replace by id,
 * which is exactly why created foods must never reuse a seed id. Duplicate ids
 * inside the override list collapse to the last one rather than both surviving.
 */
export function mergeFoodCatalog(base: NutritionItem[], overrides: NutritionItem[]): NutritionItem[] {
  const byId = new Map(overrides.map((food) => [food.id, food]));
  const baseIds = new Set(base.map((food) => food.id));
  const overridden = base.map((food) => byId.get(food.id) ?? food);
  const added = [...byId.values()].filter((food) => !baseIds.has(food.id));
  return [...overridden, ...added];
}

export function makeTrayKey(unique: string) {
  return `tray-${unique.trim() || "1"}`;
}

export function addToTray(items: TrayItem[], food: NutritionItem, unique: string): TrayItem[] {
  if (items.length >= MAX_TRAY_ITEMS) return items;
  if (!isQuantityValid(food.unit, food.amount)) return items;
  return [...items, { key: makeTrayKey(unique), food }];
}

export function removeFromTray(items: TrayItem[], key: string): TrayItem[] {
  return items.filter((item) => item.key !== key);
}

export function sumNutrition(foods: Array<Partial<NutritionTotals>>): NutritionTotals {
  const totals = foods.reduce<NutritionTotals>((sum, food) => ({
    calories: sum.calories + (Number.isFinite(food.calories) ? (food.calories as number) : 0),
    protein: sum.protein + (Number.isFinite(food.protein) ? (food.protein as number) : 0),
    carbs: sum.carbs + (Number.isFinite(food.carbs) ? (food.carbs as number) : 0),
    fat: sum.fat + (Number.isFinite(food.fat) ? (food.fat as number) : 0),
    fiber: sum.fiber + (Number.isFinite(food.fiber) ? (food.fiber as number) : 0),
  }), { ...ZERO_TOTALS });
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    calories: round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber),
  };
}

export function trayTotals(items: TrayItem[]): NutritionTotals {
  return sumNutrition(items.map((item) => item.food));
}

export function isUserMealNameValid(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MEAL_NAME_LENGTH;
}

/**
 * A saved meal keeps a snapshot of every component, so renaming, editing or
 * deleting a food later can never silently rewrite a meal you already trust.
 */
export function createUserMeal(name: string, items: TrayItem[], unique: string, createdAt: string): UserMeal | null {
  if (!isUserMealNameValid(name)) return null;
  const components = items
    .map((item) => item.food)
    .filter((food) => isQuantityValid(food.unit, food.amount))
    .slice(0, MAX_MEAL_COMPONENTS);
  if (components.length === 0) return null;
  const trimmed = name.trim();
  return {
    id: makeUserMealId(trimmed, unique),
    name: trimmed,
    createdAt,
    components: components.map((food) => ({ ...food })),
  };
}

export function userMealTotals(meal: UserMeal): NutritionTotals {
  return sumNutrition(meal.components);
}

export function upsertUserMeal(meals: UserMeal[], next: UserMeal): UserMeal[] {
  return [...meals.filter((meal) => meal.id !== next.id), next].slice(-MAX_USER_MEALS);
}

export function removeUserMeal(meals: UserMeal[], id: string): UserMeal[] {
  return meals.filter((meal) => meal.id !== id);
}

/**
 * Expands a saved meal back into loggable foods. Components are stored already
 * scaled — including whichever unit they were logged in — so re-logging a meal
 * reproduces exactly what was saved.
 */
export function userMealToFoods(meal: UserMeal): NutritionItem[] {
  return meal.components
    .filter((food) => isQuantityValid(food.unit, food.amount))
    .map((food) => ({ ...food }));
}
