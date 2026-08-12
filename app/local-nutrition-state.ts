import type { NutritionItem } from "./nutrition-data";

export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v2";
export const LEGACY_NUTRITION_STORAGE_KEY = "nourish.nutrition.v1";

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

function parseFood(value: unknown): NutritionItem | null {
  if (!value || typeof value !== "object") return null;
  const food = value as Partial<NutritionItem>;
  const numbers = [food.amount, food.calories, food.protein, food.carbs, food.fat, food.fiber];
  const rawBasis = (value as { basis?: unknown }).basis;
  const basis = rawBasis && typeof rawBasis === "object" ? rawBasis as NonNullable<NutritionItem["basis"]> : null;
  const rawConversions = (value as { conversions?: unknown }).conversions;
  const conversions = Array.isArray(rawConversions) ? rawConversions.flatMap((entry): NonNullable<NutritionItem["conversions"]> => {
    if (!entry || typeof entry !== "object") return [];
    const conversion = entry as { unit?: unknown; basisAmount?: unknown; label?: unknown };
    return units.has(conversion.unit as NutritionItem["unit"])
      && Number.isFinite(conversion.basisAmount)
      && (conversion.basisAmount as number) > 0
      && (conversion.basisAmount as number) <= 5000
      && (conversion.label === undefined || typeof conversion.label === "string")
      ? [{ unit: conversion.unit as NutritionItem["unit"], basisAmount: conversion.basisAmount as number, ...(conversion.label ? { label: conversion.label } : {}) }]
      : [];
  }) : [];
  const basisNumbers = basis ? [basis.amount, basis.calories, basis.protein, basis.carbs, basis.fat, basis.fiber] : [];
  const basisUnit = basis?.unit ?? food.unit;
  const visibleConversion = basis && food.unit !== basisUnit ? conversions.find((conversion) => conversion.unit === food.unit) : null;
  const nutritionMatchesBasis = !basis || (() => {
    const equivalentBasisAmount = Math.round((food.amount as number) * (food.unit === basisUnit ? 1 : visibleConversion?.basisAmount ?? 0) * 100) / 100;
    const scale = equivalentBasisAmount / basis.amount;
    const rounded = (number: number) => Math.round(number * scale * 100) / 100;
    return equivalentBasisAmount > 0 && [
      [food.calories, rounded(basis.calories)],
      [food.protein, rounded(basis.protein)],
      [food.carbs, rounded(basis.carbs)],
      [food.fat, rounded(basis.fat)],
      [food.fiber, rounded(basis.fiber)],
    ].every(([actual, expected]) => Math.abs((actual as number) - expected) <= 0.01);
  })();
  if (typeof food.id !== "string" || !food.id.trim()
    || typeof food.name !== "string" || !food.name.trim()
    || typeof food.brand !== "string" || !food.brand.trim()
    || typeof food.variant !== "string"
    || !units.has(food.unit as NutritionItem["unit"])
    || !categories.has(food.category as NutritionItem["category"])
    || numbers.some((number, index) => !Number.isFinite(number) || (number as number) < 0 || (index > 0 && (number as number) > 50_000))
    || basisNumbers.some((number, index) => !Number.isFinite(number) || number < 0 || (index > 0 && number > 50_000))
    || (basis !== null && basis.unit !== undefined && !units.has(basis.unit))
    || (rawBasis !== undefined && (!basis || !basis.amount))
    || (rawConversions !== undefined && (!Array.isArray(rawConversions) || conversions.length !== rawConversions.length))
    || conversions.some((conversion) => conversion.unit === basisUnit)
    || new Set(conversions.map((conversion) => conversion.unit)).size !== conversions.length
    || (basis !== null && food.unit !== basisUnit && !visibleConversion)
    || !nutritionMatchesBasis
    || !food.amount
    || food.amount > (unitLimits[food.unit as NutritionItem["unit"]] ?? 0)
    || (basis !== null && basis.amount > (unitLimits[basis.unit ?? food.unit as NutritionItem["unit"]] ?? 0))
    || typeof food.availability !== "string"
    || !Array.isArray(food.aliases) || food.aliases.some((alias) => typeof alias !== "string")
    || !food.source || typeof food.source.label !== "string" || !food.source.label.trim() || typeof food.source.url !== "string" || !trustLevels.has(food.source.trust)) return null;
  return {
    ...food,
    id: food.id.trim(),
    name: food.name.trim(),
    brand: food.brand.trim(),
    variant: food.variant.trim(),
    ...(conversions.length ? { conversions } : {}),
  } as NutritionItem;
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
    }).slice(0, 500) : [];
    const customFoods = [...new Map(parsedCustomFoods.map((food) => [food.id, food])).values()];
    const weightByDate = new Map<string, WeightEntry>();
    if (Array.isArray(value.weights)) for (const entry of value.weights) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { date?: unknown; kg?: unknown };
      if (!isDateKey(candidate.date) || !isWeightValueValid(candidate.kg as number) || (dayKey !== null && candidate.date > dayKey)) continue;
      if (weightByDate.size >= 5000 && !weightByDate.has(candidate.date)) continue;
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
