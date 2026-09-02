import type { NutritionItem } from "./nutrition-data";
import { isQuantityValid } from "./prototype-logic";

export const CUSTOM_FOOD_PREFIX = "custom-";
export const USER_MEAL_PREFIX = "usermeal-";

export const MAX_TRAY_ITEMS = 60;
export const MAX_USER_MEALS = 200;
export const MAX_MEAL_COMPONENTS = 40;
export const MAX_MEAL_NAME_LENGTH = 60;
export const MAX_NUTRITION_VALUE = 50_000;
export const MAX_FOOD_CONVERSIONS = 5;
export const MAX_CONVERSION_LABEL_LENGTH = 80;

const NON_VISIBLE_IDENTITY_CHARACTERS = /[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normaliseIdentityText(value: unknown) {
  return typeof value === "string" ? value.replace(NON_VISIBLE_IDENTITY_CHARACTERS, "").trim() : "";
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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

export type SingleItemKind = "packaged" | "ingredient" | "ordered-food";

/**
 * The old `Ordered` category means "a packaged grocery seen in order history". It must
 * stay Packaged Food in the UI; only the explicit new `OrderedFood` value represents a
 * prepared restaurant/menu order such as Subway.
 */
export function getSingleItemKind(food: Pick<NutritionItem, "category">): SingleItemKind {
  if (food.category === "Ingredient") return "ingredient";
  if (food.category === "OrderedFood") return "ordered-food";
  return "packaged";
}

export function singleItemKindLabel(kind: SingleItemKind) {
  if (kind === "ingredient") return "Open Ingredient";
  if (kind === "ordered-food") return "Ordered Food";
  return "Packaged Food";
}

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
  "name" | "brand" | "variant" | "amount" | "unit" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "conversions"
> & { category?: NutritionItem["category"]; imageUrl?: string };

/**
 * Alternate units are an explicit one-to-one mapping onto the nutrition basis.
 * Duplicates are ambiguous (which "pack" wins?) and a conversion back to the
 * basis unit itself adds no capability, so both are rejected at the save gate.
 */
export function areFoodConversionsValid(unit: NutritionItem["unit"], conversions: CustomFoodDraft["conversions"]) {
  if (!conversions?.length) return true;
  if (conversions.length > MAX_FOOD_CONVERSIONS) return false;
  const units = new Set<NutritionItem["unit"]>();
  return conversions.every((conversion) => {
    const label = conversion.label?.trim() ?? "";
    if (conversion.unit === unit || units.has(conversion.unit)) return false;
    units.add(conversion.unit);
    return Number.isFinite(conversion.basisAmount)
      && conversion.basisAmount > 0
      && conversion.basisAmount <= 5_000
      && label.length <= MAX_CONVERSION_LABEL_LENGTH;
  });
}

export function isCustomFoodDraftValid(draft: CustomFoodDraft) {
  if (!draft || typeof draft !== "object" || typeof draft.variant !== "string") return false;
  const numbers = [draft.amount, draft.calories, draft.protein, draft.carbs, draft.fat, draft.fiber];
  const brandIsValid = draft.category === "Ingredient" || Boolean(normaliseIdentityText(draft.brand));
  return Boolean(normaliseIdentityText(draft.name))
    && brandIsValid
    && isQuantityValid(draft.unit, draft.amount)
    && areFoodConversionsValid(draft.unit, draft.conversions)
    && numbers.every((value) => Number.isFinite(value) && value >= 0 && value <= MAX_NUTRITION_VALUE);
}

/**
 * Builds a brand-new food you own. Always a fresh id, so creating a food can
 * never overwrite an existing catalogue entry.
 */
export function createCustomFood(draft: CustomFoodDraft, unique: string): NutritionItem | null {
  if (!isCustomFoodDraftValid(draft)) return null;
  const name = normaliseIdentityText(draft.name);
  const brand = normaliseIdentityText(draft.brand);
  return {
    id: makeCustomFoodId(name, unique),
    name,
    brand: draft.category === "Ingredient" ? brand || "Generic" : brand,
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
    ...(draft.conversions?.length ? { conversions: draft.conversions.map((conversion) => ({ ...conversion })) } : {}),
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
  const trimmed = normaliseIdentityText(name);
  return trimmed.length > 0 && trimmed.length <= MAX_MEAL_NAME_LENGTH;
}

/** Deep copy every mutable branch of a food snapshot. */
export function cloneNutritionItem(food: NutritionItem): NutritionItem {
  return {
    ...food,
    aliases: [...food.aliases],
    source: { ...food.source },
    ...(food.conversions ? { conversions: food.conversions.map((conversion) => ({ ...conversion })) } : {}),
    ...(food.basis ? { basis: { ...food.basis } } : {}),
    ...(food.components ? { components: food.components.map((component) => ({ ...component })) } : {}),
  };
}

/**
 * A saved meal keeps a snapshot of every component, so renaming, editing or
 * deleting a food later can never silently rewrite a meal you already trust.
 */
export function createUserMeal(name: string, items: TrayItem[], unique: string, createdAt: string): UserMeal | null {
  if (!isUserMealNameValid(name) || !isDateKey(createdAt)) return null;
  const components = items
    .map((item) => item.food)
    .filter((food) => isQuantityValid(food.unit, food.amount))
    .slice(0, MAX_MEAL_COMPONENTS);
  if (components.length === 0) return null;
  const totals = sumNutrition(components);
  if (Object.values(totals).some((value) => value < 0 || value > MAX_NUTRITION_VALUE)) return null;
  const trimmed = normaliseIdentityText(name);
  return {
    id: makeUserMealId(trimmed, unique),
    name: trimmed,
    createdAt,
    components: components.map(cloneNutritionItem),
  };
}

export function userMealTotals(meal: UserMeal): NutritionTotals {
  return sumNutrition(meal.components);
}

/** A diary edit receives its own component objects, never the reusable saved Meal. */
export function cloneUserMeal(meal: UserMeal): UserMeal {
  return { ...meal, components: meal.components.map(cloneNutritionItem) };
}

/** One aggregate diary row backed by expandable component snapshots. */
export function userMealToNutritionItem(meal: UserMeal, trust: NutritionItem["source"]["trust"] = "Personal"): NutritionItem {
  const totals = userMealTotals(meal);
  return {
    id: meal.id,
    name: meal.name,
    brand: trust === "Personal" ? "My Meal" : "Nourish",
    variant: `${meal.components.length} item${meal.components.length === 1 ? "" : "s"}`,
    amount: 1,
    unit: "serving",
    ...totals,
    category: "Meal",
    availability: "Saved meal",
    aliases: meal.components.flatMap((food) => [food.name, food.brand, ...food.aliases]),
    source: {
      label: trust === "Personal" ? "Grouped by you" : "Calculated from weighed ingredients",
      url: "",
      trust,
    },
  };
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
    .map(cloneNutritionItem);
}
