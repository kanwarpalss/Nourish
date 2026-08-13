import {
  FOOD_CATEGORIES,
  MAX_RECIPE_COMPONENTS,
  SOURCE_TRUSTS,
  UNIT_LIMITS,
  isFoodUnit,
  type Food,
  type FoodComponent,
  type FoodImage,
} from "./food-model";

// v3 stores one unified food list (products and recipes together).
// v2 stored products only; v1 predates custom foods. Both are read and carried
// forward so an upgrade never starts KP from an empty catalogue.
export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v3";
export const LEGACY_NUTRITION_STORAGE_KEYS = ["nourish.nutrition.v2", "nourish.nutrition.v1"] as const;
/** @deprecated Use LEGACY_NUTRITION_STORAGE_KEYS. */
export const LEGACY_NUTRITION_STORAGE_KEY = LEGACY_NUTRITION_STORAGE_KEYS[0];

export type SavedLogEntry = {
  foodId: string;
  amount: number;
  snapshot?: Food;
};

export type SavedPlanEntry = {
  id: string;
  /** Quantity in the food's own unit. Absent on entries saved before v3; the catalogue default is used. */
  amount?: number;
};

export type WeightEntry = {
  date: string;
  kg: number;
};

export type SavedNutritionState = {
  dayKey: string | null;
  logs: SavedLogEntry[];
  planned: SavedPlanEntry[];
  customFoods: Food[];
  weights: WeightEntry[];
};

const categories = new Set<Food["category"]>(FOOD_CATEGORIES);
const trustLevels = new Set<Food["source"]["trust"]>(SOURCE_TRUSTS);
const imageKinds = new Set<FoodImage["kind"]>(["pack", "label", "dish"]);
const MAX_CUSTOM_FOODS = 500;
const MAX_WEIGHT_ENTRIES = 5000;

const emptyState = (): SavedNutritionState => ({ dayKey: null, logs: [], planned: [], customFoods: [], weights: [] });

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

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Only http(s) and same-origin /food-images/ paths. Blocks javascript:/data: URLs reaching an <img src>. */
function parseImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("/food-images/") && !url.includes("..")) return url;
  return /^https:\/\/[^\s]+$/i.test(url) || /^http:\/\/[^\s]+$/i.test(url) ? url : null;
}

function parseImages(value: unknown): FoodImage[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const images = value.flatMap((entry): FoodImage[] => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { url?: unknown; kind?: unknown; credit?: unknown };
    const url = parseImageUrl(candidate.url);
    if (!url) return [];
    const kind = imageKinds.has(candidate.kind as FoodImage["kind"]) ? candidate.kind as FoodImage["kind"] : "pack";
    return [{ url, kind, ...(typeof candidate.credit === "string" && candidate.credit.trim() ? { credit: candidate.credit.trim() } : {}) }];
  }).slice(0, 6);
  return images.length > 0 ? images : undefined;
}

function parseComponents(value: unknown): FoodComponent[] | null {
  if (!Array.isArray(value)) return null;
  const components = value.flatMap((entry): FoodComponent[] => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { foodId?: unknown; amount?: unknown };
    if (typeof candidate.foodId !== "string" || !candidate.foodId.trim() || !isPositiveNumber(candidate.amount)) return [];
    return [{ foodId: candidate.foodId.trim(), amount: candidate.amount }];
  });
  // A dropped component would silently change a meal's nutrition, so reject the
  // whole record instead of saving a quietly wrong meal (EDGE-03).
  if (components.length !== value.length || components.length > MAX_RECIPE_COMPONENTS) return null;
  return components;
}

function parseStringArray(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((entry): entry is string => typeof entry === "string");
  return items.length === value.length ? items.slice(0, limit) : null;
}

export function parseFood(value: unknown): Food | null {
  if (!value || typeof value !== "object") return null;
  const food = value as Partial<Food> & Record<string, unknown>;

  if (typeof food.id !== "string" || !food.id.trim()) return null;
  if (typeof food.name !== "string" || !food.name.trim()) return null;
  if (typeof food.brand !== "string" || !food.brand.trim()) return null;
  if (typeof food.variant !== "string") return null;
  if (!isFoodUnit(food.unit)) return null;
  if (!categories.has(food.category as Food["category"])) return null;
  if (typeof food.availability !== "string") return null;
  if (!food.source || typeof food.source !== "object") return null;
  if (typeof food.source.label !== "string" || !food.source.label.trim()) return null;
  if (typeof food.source.url !== "string" || !trustLevels.has(food.source.trust)) return null;

  const aliases = parseStringArray(food.aliases, 40);
  if (!aliases) return null;

  const limit = UNIT_LIMITS[food.unit];
  const macros = [food.calories, food.protein, food.carbs, food.fat, food.fiber];
  if (!isPositiveNumber(food.amount) || food.amount > limit) return null;
  if (!macros.every(isNonNegativeNumber)) return null;

  // `basis` carries the pre-scaling numbers on a logged snapshot.
  const rawBasis = food.basis as unknown;
  let basis: Food["basis"];
  if (rawBasis !== undefined) {
    if (!rawBasis || typeof rawBasis !== "object") return null;
    const candidate = rawBasis as Record<string, unknown>;
    const basisMacros = [candidate.calories, candidate.protein, candidate.carbs, candidate.fat, candidate.fiber];
    if (!isPositiveNumber(candidate.amount) || candidate.amount > limit || !basisMacros.every(isNonNegativeNumber)) return null;
    basis = {
      amount: candidate.amount,
      calories: candidate.calories as number,
      protein: candidate.protein as number,
      carbs: candidate.carbs as number,
      fat: candidate.fat as number,
      fiber: candidate.fiber as number,
    };
  }

  // v2 records had no `kind`; every one of them was a product.
  const kind: Food["kind"] = food.kind === "recipe" ? "recipe" : "product";
  let components: FoodComponent[] | undefined;
  if (kind === "recipe") {
    const parsed = parseComponents(food.components);
    if (!parsed) return null;
    components = parsed;
  } else if (food.components !== undefined && (!Array.isArray(food.components) || food.components.length > 0)) {
    return null;
  }

  const optionalStrings = (["packSize", "barcode", "serving", "time", "art", "description", "sourceNote"] as const)
    .reduce<Partial<Food>>((carry, key) => {
      const raw = food[key];
      return typeof raw === "string" && raw.trim() ? { ...carry, [key]: raw.trim() } : carry;
    }, {});

  for (const key of ["sugar", "sodium"] as const) {
    if (food[key] !== undefined && !isNonNegativeNumber(food[key])) return null;
  }
  if (food.totalMinutes !== undefined && !isNonNegativeNumber(food.totalMinutes)) return null;

  const images = parseImages(food.images);
  const tags = food.tags === undefined ? undefined : parseStringArray(food.tags, 20);
  if (food.tags !== undefined && !tags) return null;
  const ingredients = food.ingredients === undefined ? undefined : parseStringArray(food.ingredients, 60);
  if (food.ingredients !== undefined && !ingredients) return null;
  const method = food.method === undefined ? undefined : parseStringArray(food.method, 40);
  if (food.method !== undefined && !method) return null;

  return {
    id: food.id.trim(),
    kind,
    brand: food.brand.trim(),
    name: food.name.trim(),
    variant: food.variant.trim(),
    amount: food.amount,
    unit: food.unit,
    calories: food.calories as number,
    protein: food.protein as number,
    carbs: food.carbs as number,
    fat: food.fat as number,
    fiber: food.fiber as number,
    category: food.category as Food["category"],
    availability: food.availability,
    aliases,
    source: { label: food.source.label.trim(), url: food.source.url, trust: food.source.trust },
    ...(food.common === true ? { common: true } : {}),
    ...(food.preparedMeal === true ? { preparedMeal: true } : {}),
    ...(basis ? { basis } : {}),
    ...(components ? { components } : {}),
    ...(images ? { images } : {}),
    ...(tags ? { tags } : {}),
    ...(ingredients ? { ingredients } : {}),
    ...(method ? { method } : {}),
    ...(isNonNegativeNumber(food.sugar) ? { sugar: food.sugar } : {}),
    ...(isNonNegativeNumber(food.sodium) ? { sodium: food.sodium } : {}),
    ...(isNonNegativeNumber(food.totalMinutes) ? { totalMinutes: food.totalMinutes } : {}),
    ...optionalStrings,
  };
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
    const value = parsed as { dayKey?: unknown; logs?: unknown; planned?: unknown; customFoods?: unknown; weights?: unknown };
    const dayKey = isDateKey(value.dayKey) ? value.dayKey : null;

    const logs = Array.isArray(value.logs) ? value.logs.flatMap((entry): SavedLogEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { foodId?: unknown; amount?: unknown; snapshot?: unknown };
      if (typeof candidate.foodId !== "string" || !candidate.foodId.trim() || !isPositiveNumber(candidate.amount)) return [];
      const parsedSnapshot = candidate.snapshot === undefined ? undefined : parseFood(candidate.snapshot);
      if (candidate.snapshot !== undefined && !parsedSnapshot) return [];
      const foodId = candidate.foodId.trim();
      if (parsedSnapshot && parsedSnapshot.id !== foodId) return [];
      return [{ foodId, amount: candidate.amount, ...(parsedSnapshot ? { snapshot: parsedSnapshot } : {}) }];
    }) : [];

    // v2 wrote { id, kind }. `kind` is now derived from the catalogue, so it is
    // read and discarded; `amount` is new and optional.
    const planned = Array.isArray(value.planned) ? value.planned.flatMap((entry): SavedPlanEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { id?: unknown; amount?: unknown };
      if (typeof candidate.id !== "string" || !candidate.id.trim()) return [];
      return [{ id: candidate.id.trim(), ...(isPositiveNumber(candidate.amount) ? { amount: candidate.amount } : {}) }];
    }) : [];

    const parsedCustomFoods = Array.isArray(value.customFoods) ? value.customFoods.flatMap((food) => {
      const parsedFood = parseFood(food);
      return parsedFood ? [parsedFood] : [];
    }).slice(0, MAX_CUSTOM_FOODS) : [];
    const customFoods = [...new Map(parsedCustomFoods.map((food) => [food.id, food])).values()];

    const weightByDate = new Map<string, WeightEntry>();
    if (Array.isArray(value.weights)) for (const entry of value.weights) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { date?: unknown; kg?: unknown };
      if (!isDateKey(candidate.date) || !isWeightValueValid(candidate.kg as number) || (dayKey !== null && candidate.date > dayKey)) continue;
      if (weightByDate.size >= MAX_WEIGHT_ENTRIES && !weightByDate.has(candidate.date)) continue;
      weightByDate.set(candidate.date, { date: candidate.date, kg: Math.round((candidate.kg as number) * 10) / 10 });
    }
    const weights = [...weightByDate.values()].sort((left, right) => left.date.localeCompare(right.date));

    return { dayKey, logs, planned, customFoods, weights };
  } catch {
    return emptyState();
  }
}

export function stringifySavedNutritionState(state: SavedNutritionState) {
  return JSON.stringify(state);
}

export function shouldRestoreSavedNutritionState(state: SavedNutritionState, dayKey: string) {
  return state.dayKey === null || state.dayKey === dayKey;
}

/** Newest schema wins; older keys are read only when the current one is absent. */
export function readStoredNutritionRaw(read: (key: string) => string | null): string | null {
  for (const key of [LOCAL_NUTRITION_STORAGE_KEY, ...LEGACY_NUTRITION_STORAGE_KEYS]) {
    const raw = read(key);
    if (raw) return raw;
  }
  return null;
}
