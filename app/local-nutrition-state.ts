import type { UserMeal } from "./logging-session";
import type { NutritionItem } from "./nutrition-data";

export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v3";
/** Older keys are read once so an upgrade never looks like data loss. */
export const LEGACY_NUTRITION_STORAGE_KEYS = ["nourish.nutrition.v2", "nourish.nutrition.v1"];
export const LEGACY_NUTRITION_STORAGE_KEY = LEGACY_NUTRITION_STORAGE_KEYS[0];

export const MAX_SAVED_CUSTOM_FOODS = 500;
export const MAX_SAVED_USER_MEALS = 200;
export const MAX_SAVED_MEAL_COMPONENTS = 40;

export type SavedLogEntry = {
  foodId: string;
  amount: number;
  snapshot?: NutritionItem;
};

export type SavedPlanEntry = {
  id: string;
  kind: "food" | "meal";
};

export type SavedNutritionState = {
  dayKey: string | null;
  logs: SavedLogEntry[];
  planned: SavedPlanEntry[];
  customFoods: NutritionItem[];
  userMeals: UserMeal[];
  weights: WeightEntry[];
};

export type WeightEntry = {
  date: string;
  kg: number;
};

const units = new Set<NutritionItem["unit"]>(["g", "ml", "scoop", "pack", "piece", "serving"]);
const unitLimits: Record<NutritionItem["unit"], number> = { g: 5000, ml: 5000, scoop: 10, pack: 20, piece: 50, serving: 20 };
const categories = new Set<NutritionItem["category"]>(["Ordered", "Product", "Ingredient", "Meal"]);
const trustLevels = new Set<NutritionItem["source"]["trust"]>(["Official label", "Reference", "Label mirror", "Personal"]);

const emptyState = (): SavedNutritionState => ({ dayKey: null, logs: [], planned: [], customFoods: [], userMeals: [], weights: [] });

/**
 * Photo links are rendered straight into an img tag, so only ordinary web URLs
 * are kept. Anything else is dropped rather than stored and echoed back.
 */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isWeightValueValid(value: number) {
  return Number.isFinite(value) && value >= 20 && value <= 400;
}

export function shouldPersistNutritionState(storageLoaded: boolean, loadedDay: string | null, currentDay: string) {
  return storageLoaded && loadedDay === currentDay;
}

function parseFood(value: unknown): NutritionItem | null {
  if (!value || typeof value !== "object") return null;
  const food = value as Partial<NutritionItem>;
  const numbers = [food.amount, food.calories, food.protein, food.carbs, food.fat, food.fiber];
  const rawBasis = (value as { basis?: unknown }).basis;
  const basis = rawBasis && typeof rawBasis === "object" ? rawBasis as NonNullable<NutritionItem["basis"]> : null;
  const basisNumbers = basis ? [basis.amount, basis.calories, basis.protein, basis.carbs, basis.fat, basis.fiber] : [];
  if (typeof food.id !== "string" || !food.id.trim()
    || typeof food.name !== "string" || !food.name.trim()
    || typeof food.brand !== "string" || !food.brand.trim()
    || typeof food.variant !== "string"
    || !units.has(food.unit as NutritionItem["unit"])
    || !categories.has(food.category as NutritionItem["category"])
    || numbers.some((number) => !Number.isFinite(number) || (number as number) < 0)
    || basisNumbers.some((number) => !Number.isFinite(number) || number < 0)
    || (rawBasis !== undefined && (!basis || !basis.amount))
    || !food.amount
    || food.amount > (unitLimits[food.unit as NutritionItem["unit"]] ?? 0)
    || (basis !== null && basis.amount > (unitLimits[food.unit as NutritionItem["unit"]] ?? 0))
    || typeof food.availability !== "string"
    || !Array.isArray(food.aliases) || food.aliases.some((alias) => typeof alias !== "string")
    || !food.source || typeof food.source.label !== "string" || !food.source.label.trim() || typeof food.source.url !== "string" || !trustLevels.has(food.source.trust)) return null;
  const rawImageUrl = (value as { imageUrl?: unknown }).imageUrl;
  const parsed = {
    ...food,
    id: food.id.trim(),
    name: food.name.trim(),
    brand: food.brand.trim(),
    variant: food.variant.trim(),
  } as NutritionItem;
  // An unusable photo link loses a thumbnail, never the food itself.
  if (isSafeImageUrl(rawImageUrl)) parsed.imageUrl = rawImageUrl;
  else delete parsed.imageUrl;
  return parsed;
}

function parseUserMeal(value: unknown): UserMeal | null {
  if (!value || typeof value !== "object") return null;
  const meal = value as { id?: unknown; name?: unknown; createdAt?: unknown; components?: unknown };
  if (typeof meal.id !== "string" || !meal.id.trim()) return null;
  if (typeof meal.name !== "string" || !meal.name.trim() || meal.name.trim().length > 60) return null;
  if (typeof meal.createdAt !== "string" || !isDateKey(meal.createdAt)) return null;
  if (!Array.isArray(meal.components)) return null;
  const components = meal.components
    .flatMap((component) => {
      const parsedComponent = parseFood(component);
      return parsedComponent ? [parsedComponent] : [];
    })
    .slice(0, MAX_SAVED_MEAL_COMPONENTS);
  // A meal with nothing loggable left in it would silently log zero calories.
  if (components.length === 0) return null;
  return { id: meal.id.trim(), name: meal.name.trim(), createdAt: meal.createdAt, components };
}

export function upsertWeightEntry(entries: WeightEntry[], next: WeightEntry) {
  if (!isDateKey(next.date) || !isWeightValueValid(next.kg)) return entries;
  return [...entries.filter((entry) => isDateKey(entry.date) && isWeightValueValid(entry.kg) && entry.date !== next.date), { date: next.date, kg: Math.round(next.kg * 10) / 10 }]
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function getWeightTrendPoints(entries: WeightEntry[], width = 300, height = 110) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || entries.length === 0) return [];
  const canonical = new Map<string, WeightEntry>();
  for (const entry of entries) if (isDateKey(entry.date) && isWeightValueValid(entry.kg)) canonical.set(entry.date, entry);
  const sorted = [...canonical.values()].sort((left, right) => left.date.localeCompare(right.date));
  if (sorted.length === 0) return [];
  const min = Math.min(...sorted.map((entry) => entry.kg));
  const max = Math.max(...sorted.map((entry) => entry.kg));
  const range = Math.max(1, max - min);
  const firstTime = Date.parse(`${sorted[0].date}T00:00:00.000Z`);
  const lastTime = Date.parse(`${sorted.at(-1)?.date}T00:00:00.000Z`);
  const timeRange = lastTime - firstTime;
  return sorted.map((entry) => ({
    ...entry,
    x: sorted.length === 1 ? width / 2 : Math.round(((Date.parse(`${entry.date}T00:00:00.000Z`) - firstTime) / timeRange) * width * 100) / 100,
    y: max === min ? height / 2 : Math.round((height - ((entry.kg - min) / range) * height) * 100) / 100,
  }));
}

export function parseSavedNutritionState(raw: string | null): SavedNutritionState {
  if (!raw) return emptyState();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    const value = parsed as { dayKey?: unknown; logs?: unknown; planned?: unknown; customFoods?: unknown; userMeals?: unknown; weights?: unknown };
    const dayKey = isDateKey(value.dayKey) ? value.dayKey : null;
    const logs = Array.isArray(value.logs) ? value.logs.flatMap((entry): SavedLogEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { foodId?: unknown; amount?: unknown; snapshot?: unknown };
      if (typeof candidate.foodId !== "string" || !candidate.foodId.trim() || !Number.isFinite(candidate.amount) || (candidate.amount as number) <= 0) return [];
      const parsedSnapshot = candidate.snapshot === undefined ? undefined : parseFood(candidate.snapshot);
      if (candidate.snapshot !== undefined && !parsedSnapshot) return [];
      const foodId = candidate.foodId.trim();
      if (parsedSnapshot && parsedSnapshot.id !== foodId) return [];
      const snapshot = parsedSnapshot ?? undefined;
      return [{ foodId, amount: candidate.amount as number, ...(snapshot ? { snapshot } : {}) }];
    }) : [];
    const planned = Array.isArray(value.planned) ? value.planned.flatMap((entry): SavedPlanEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { id?: unknown; kind?: unknown };
      return typeof candidate.id === "string" && candidate.id.trim().length > 0 && (candidate.kind === "food" || candidate.kind === "meal") ? [{ id: candidate.id.trim(), kind: candidate.kind }] : [];
    }) : [];
    const parsedCustomFoods = Array.isArray(value.customFoods) ? value.customFoods.flatMap((food) => {
      const parsedFood = parseFood(food);
      return parsedFood ? [parsedFood] : [];
    }).slice(0, MAX_SAVED_CUSTOM_FOODS) : [];
    const customFoods = [...new Map(parsedCustomFoods.map((food) => [food.id, food])).values()];
    const parsedUserMeals = Array.isArray(value.userMeals) ? value.userMeals.flatMap((meal) => {
      const parsedMeal = parseUserMeal(meal);
      return parsedMeal ? [parsedMeal] : [];
    }).slice(0, MAX_SAVED_USER_MEALS) : [];
    const userMeals = [...new Map(parsedUserMeals.map((meal) => [meal.id, meal])).values()];
    const weightByDate = new Map<string, WeightEntry>();
    if (Array.isArray(value.weights)) for (const entry of value.weights) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { date?: unknown; kg?: unknown };
      if (!isDateKey(candidate.date) || !isWeightValueValid(candidate.kg as number) || (dayKey !== null && candidate.date > dayKey)) continue;
      if (weightByDate.size >= 5000 && !weightByDate.has(candidate.date)) continue;
      weightByDate.set(candidate.date, { date: candidate.date, kg: Math.round((candidate.kg as number) * 10) / 10 });
    }
    const weights = [...weightByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
    return { dayKey, logs, planned, customFoods, userMeals, weights };
  } catch {
    return emptyState();
  }
}

/**
 * Reads the current key, falling back through older ones so a schema bump never
 * looks like a wiped diary. Takes the reader so it can be tested without a browser.
 */
export function readSavedNutritionRaw(read: (key: string) => string | null): string | null {
  const current = read(LOCAL_NUTRITION_STORAGE_KEY);
  if (current) return current;
  for (const key of LEGACY_NUTRITION_STORAGE_KEYS) {
    const legacy = read(key);
    if (legacy) return legacy;
  }
  return null;
}

export function stringifySavedNutritionState(state: SavedNutritionState) {
  return JSON.stringify(state);
}

export function shouldRestoreSavedNutritionState(state: SavedNutritionState, dayKey: string) {
  return state.dayKey === null || state.dayKey === dayKey;
}
