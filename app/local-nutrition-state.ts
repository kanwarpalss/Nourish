import { MAX_MEAL_COMPONENTS, MAX_NUTRITION_VALUE, MAX_USER_MEALS, userMealTotals, type UserMeal } from "./logging-session";
import type { NutritionItem } from "./nutrition-data";
import { isQuantityValid } from "./prototype-logic";

export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v3";
export const LEGACY_NUTRITION_STORAGE_KEYS = ["nourish.nutrition.v2", "nourish.nutrition.v1"] as const;
/**
 * The previous good payload, kept so one bad write cannot be the end of the diary.
 * Read only when the live key is missing or unparseable.
 */
export const NUTRITION_BACKUP_STORAGE_KEY = "nourish.nutrition.backup";

/**
 * Every top-level field this build understands. Anything else found in storage is
 * carried through untouched (see `carried`), because a build that drops fields it
 * does not recognise destroys data written by a newer one — which is exactly how
 * "my entries vanished after an update" happens.
 */
export const KNOWN_STATE_KEYS = ["schemaVersion", "days", "planned", "targets", "customFoods", "userMeals", "weights"] as const;

/**
 * How many days of diary are kept. Thirteen months so a full year of trends always has a
 * comparison period. Each entry is a few dozen bytes, so even a heavily used year is far
 * inside the browser's storage budget.
 */
export const MAX_STORED_DAYS = 400;

/**
 * A hand-typed replacement for a log entry's name and macros. KP must always be able to
 * correct a prefilled number or rename an item at log time — a researched default is a
 * starting point, not a ceiling. Once present, these numbers are the entry's final total;
 * nothing scales them further.
 */
export type SavedLogOverride = {
  name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type SavedLogEntry = {
  foodId: string;
  amount: number;
  /** Exact food identity, displayed unit and calculated totals at the moment of logging. */
  snapshot?: NutritionItem;
  /** A grouped Meal stays one diary row while retaining its expandable item snapshots. */
  mealSnapshot?: UserMeal;
  /**
   * Only set for composite dishes. The edited component weights must be saved, otherwise a
   * chapati rolled from 45 g of atta would come back after a refresh as the 30 g default.
   */
  components?: Array<{ foodId: string; amount: number }>;
  /** When set, this entry's name and macros come from KP directly rather than the catalogue. */
  override?: SavedLogOverride;
};

export type SavedPlanEntry = {
  id: string;
  kind: "food" | "meal";
};

/** One Bangalore-local day of diary. */
export type SavedDay = {
  dayKey: string;
  logs: SavedLogEntry[];
};

export type SavedTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type WeightEntry = { date: string; kg: number };

/**
 * Schema 2 keeps every day rather than only the current one.
 *
 * Schema 1 stored a single `{ dayKey, logs }`. When the Bangalore day rolled over, the app
 * declined to restore the previous day and then immediately autosaved the new empty day
 * over the same key, so the diary was destroyed every midnight. That also made a truthful
 * History or Trends view impossible, because no history was ever retained.
 */
/** Exactly what is written to storage. */
export type PersistedNutritionState = {
  schemaVersion: 2;
  days: SavedDay[];
  planned: SavedPlanEntry[];
  targets: SavedTargets | null;
  customFoods: NutritionItem[];
  /** Groups you saved from a logging tray, each keeping its own component snapshots. */
  userMeals: UserMeal[];
  weights: WeightEntry[];
  /**
   * Fields found in storage that this build does not know about, preserved
   * verbatim and written back, so an older build cannot silently delete data a
   * newer one wrote. This is what stops "my entries vanished after an update".
   */
  carried?: Record<string, unknown>;
};

export type SavedNutritionState = PersistedNutritionState & {
  /**
   * How many stored records this load discarded as malformed. Dropping a damaged
   * record is right — guessing at it would corrupt totals — but doing it in
   * silence is not, so Today reports the count. Never written back to storage.
   */
  rejected: number;
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const emptyNutritionState = (): SavedNutritionState => ({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [], userMeals: [], weights: [], rejected: 0 });

const units = new Set<NutritionItem["unit"]>(["g", "ml", "scoop", "pack", "piece", "serving"]);
const categories = new Set<NutritionItem["category"]>(["Ordered", "Product", "Ingredient", "OrderedFood", "Meal", "Composite"]);
const trustLevels = new Set<NutritionItem["source"]["trust"]>(["Official label", "Reference", "Label mirror", "Estimated", "Personal"]);

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function currentBangaloreDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
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
      && Number.isFinite(conversion.basisAmount) && (conversion.basisAmount as number) > 0 && (conversion.basisAmount as number) <= 5000
      && (conversion.label === undefined || typeof conversion.label === "string")
      ? [{ unit: conversion.unit as NutritionItem["unit"], basisAmount: conversion.basisAmount as number, ...(conversion.label ? { label: conversion.label } : {}) }]
      : [];
  }) : [];
  const basisNumbers = basis ? [basis.amount, basis.calories, basis.protein, basis.carbs, basis.fat, basis.fiber] : [];
  const basisUnit = basis?.unit ?? food.unit;
  const visibleConversion = basis && food.unit !== basisUnit ? conversions.find((conversion) => conversion.unit === food.unit) : null;
  const nutritionMatchesBasis = !basis || (() => {
    const equivalent = Math.round((food.amount as number) * (food.unit === basisUnit ? 1 : visibleConversion?.basisAmount ?? 0) * 100) / 100;
    const scale = equivalent / basis.amount;
    const rounded = (number: number) => Math.round(number * scale * 100) / 100;
    return equivalent > 0 && [[food.calories, rounded(basis.calories)], [food.protein, rounded(basis.protein)], [food.carbs, rounded(basis.carbs)], [food.fat, rounded(basis.fat)], [food.fiber, rounded(basis.fiber)]]
      .every(([actual, expected]) => Number.isFinite(actual) && Number.isFinite(expected) && Math.abs((actual as number) - (expected as number)) <= 0.01);
  })();
  if (typeof food.id !== "string" || !food.id.trim() || typeof food.name !== "string" || !food.name.trim()
    || typeof food.brand !== "string" || !food.brand.trim() || typeof food.variant !== "string"
    || !units.has(food.unit as NutritionItem["unit"]) || !categories.has(food.category as NutritionItem["category"])
    || numbers.some((number) => !Number.isFinite(number) || (number as number) < 0 || (number as number) > MAX_NUTRITION_VALUE)
    || !isQuantityValid(food.unit as string, food.amount as number)
    || basisNumbers.some((number) => !Number.isFinite(number) || number < 0 || number > MAX_NUTRITION_VALUE)
    || (basis !== null && basis.unit !== undefined && !units.has(basis.unit))
    || (rawBasis !== undefined && (!basis || !basis.amount))
    || (rawConversions !== undefined && (!Array.isArray(rawConversions) || conversions.length !== rawConversions.length))
    || conversions.some((conversion) => conversion.unit === basisUnit)
    || new Set(conversions.map((conversion) => conversion.unit)).size !== conversions.length
    || (basis !== null && food.unit !== basisUnit && !visibleConversion) || !nutritionMatchesBasis
    || typeof food.availability !== "string" || !Array.isArray(food.aliases) || food.aliases.some((alias) => typeof alias !== "string")
    || !food.source || typeof food.source.label !== "string" || !food.source.label.trim() || typeof food.source.url !== "string" || !trustLevels.has(food.source.trust)) return null;
  const rawImageUrl = (value as { imageUrl?: unknown }).imageUrl;
  const parsed = { ...food, id: food.id.trim(), name: food.name.trim(), brand: food.brand.trim(), variant: food.variant.trim(), ...(conversions.length ? { conversions } : {}) } as NutritionItem;
  // An unusable photo link loses a thumbnail, never the food itself.
  if (isSafeImageUrl(rawImageUrl)) parsed.imageUrl = rawImageUrl;
  else delete parsed.imageUrl;
  return parsed;
}

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
    .slice(0, MAX_MEAL_COMPONENTS);
  // A meal with nothing loggable left in it would silently log zero calories.
  if (components.length === 0) return null;
  const parsed = { id: meal.id.trim(), name: meal.name.trim(), createdAt: meal.createdAt, components };
  if (Object.values(userMealTotals(parsed)).some((total) => total > MAX_NUTRITION_VALUE)) return null;
  return parsed;
}

export function isWeightValueValid(value: number) {
  return Number.isFinite(value) && value >= 20 && value <= 400;
}

export function upsertWeightEntry(entries: WeightEntry[], next: WeightEntry) {
  if (!isDateKey(next.date) || next.date > currentBangaloreDayKey() || !isWeightValueValid(next.kg)) return entries;
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
  const firstTime = Date.parse(`${sorted[0].date}T00:00:00.000Z`);
  const lastTime = Date.parse(`${sorted.at(-1)?.date}T00:00:00.000Z`);
  const timeRange = lastTime - firstTime;
  return sorted.map((entry) => ({
    ...entry,
    x: sorted.length === 1 ? width / 2 : Math.round(((Date.parse(`${entry.date}T00:00:00.000Z`) - firstTime) / timeRange) * width * 100) / 100,
    y: max === min ? height / 2 : Math.round((height - ((entry.kg - min) / Math.max(1, max - min)) * height) * 100) / 100,
  }));
}

/** A malformed override drops the override, not the whole entry — it falls back to the catalogue. */
function parseLogOverride(value: unknown): SavedLogOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const numericFields = ["calories", "protein", "carbs", "fat", "fiber"] as const;
  const parsed = {} as Pick<SavedLogOverride, (typeof numericFields)[number]>;
  for (const field of numericFields) {
    const raw = candidate[field];
    if (!Number.isFinite(raw) || (raw as number) < 0) return undefined;
    parsed[field] = raw as number;
  }
  // Calories of exactly zero for every field is not a usable override — it is what an empty
  // or abandoned edit would look like, and a real entry should not silently vanish to 0 kcal.
  if (parsed.calories === 0 && parsed.protein === 0 && parsed.carbs === 0 && parsed.fat === 0) return undefined;
  const name = typeof candidate.name === "string" && candidate.name.trim().length > 0 ? candidate.name.trim().slice(0, 120) : undefined;
  return name ? { ...parsed, name } : parsed;
}

function parseLogEntry(entry: unknown): SavedLogEntry[] {
  if (!entry || typeof entry !== "object") return [];
  const candidate = entry as { foodId?: unknown; amount?: unknown; snapshot?: unknown; mealSnapshot?: unknown; components?: unknown; override?: unknown };
  if (typeof candidate.foodId !== "string" || candidate.foodId.length === 0) return [];
  if (!Number.isFinite(candidate.amount) || (candidate.amount as number) <= 0) return [];
  const components = Array.isArray(candidate.components)
    ? candidate.components.flatMap((part): Array<{ foodId: string; amount: number }> => {
      if (!part || typeof part !== "object") return [];
      const component = part as { foodId?: unknown; amount?: unknown };
      return typeof component.foodId === "string" && component.foodId.length > 0 && Number.isFinite(component.amount) && (component.amount as number) > 0
        ? [{ foodId: component.foodId, amount: component.amount as number }]
        : [];
    })
    : [];
  const saved: SavedLogEntry = { foodId: candidate.foodId, amount: candidate.amount as number };
  const snapshot = candidate.snapshot === undefined ? undefined : parseFood(candidate.snapshot);
  if (candidate.snapshot !== undefined && (!snapshot || snapshot.id !== candidate.foodId)) return [];
  if (snapshot) {
    saved.snapshot = snapshot;
    const mealSnapshot = candidate.mealSnapshot === undefined ? null : parseUserMeal(candidate.mealSnapshot);
    if (mealSnapshot) {
      const totals = userMealTotals(mealSnapshot);
      const fields = ["calories", "protein", "carbs", "fat", "fiber"] as const;
      const identityMatches = snapshot.category === "Meal"
        && snapshot.unit === "serving"
        && snapshot.amount === 1
        && candidate.amount === 1
        && mealSnapshot.id === snapshot.id
        && mealSnapshot.name === snapshot.name;
      if (identityMatches && fields.every((field) => Math.abs(totals[field] - snapshot[field]) <= 0.01)) saved.mealSnapshot = mealSnapshot;
    }
    return [saved];
  }
  const override = parseLogOverride(candidate.override);
  // An override replaces the entry's numbers outright, so components (which would otherwise
  // be re-summed into a different total) are dropped rather than saved alongside it.
  if (override) saved.override = override;
  else if (components.length > 0) saved.components = components;
  return [saved];
}

function parsePlanEntry(entry: unknown): SavedPlanEntry[] {
  if (!entry || typeof entry !== "object") return [];
  const candidate = entry as { id?: unknown; kind?: unknown };
  return typeof candidate.id === "string" && candidate.id.length > 0 && (candidate.kind === "food" || candidate.kind === "meal")
    ? [{ id: candidate.id, kind: candidate.kind }]
    : [];
}

function parseTargets(value: unknown): SavedTargets | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const fields = ["calories", "protein", "carbs", "fat"] as const;
  const parsed = {} as SavedTargets;
  for (const field of fields) {
    const raw = candidate[field];
    if (!Number.isFinite(raw) || (raw as number) <= 0) return null;
    parsed[field] = raw as number;
  }
  return parsed;
}

/** Newest first, one entry per day, capped. Empty days are dropped so they cannot masquerade as fasted days. */
function normaliseDays(days: SavedDay[]): SavedDay[] {
  const byKey = new Map<string, SavedDay>();
  for (const day of days) {
    if (!DAY_KEY_PATTERN.test(day.dayKey) || day.logs.length === 0) continue;
    const existing = byKey.get(day.dayKey);
    // A duplicated key keeps the richer record rather than whichever happened to be last.
    if (!existing || day.logs.length > existing.logs.length) byKey.set(day.dayKey, day);
  }
  return [...byKey.values()].sort((a, b) => b.dayKey.localeCompare(a.dayKey)).slice(0, MAX_STORED_DAYS);
}

/**
 * How many stored records a parse threw away. Counted by comparing what came in
 * against what survived, so no parse helper needs a mutable counter threaded
 * through it. Never persisted — it describes one load, not the diary.
 */
function countDropped(input: unknown, kept: number) {
  return Array.isArray(input) ? Math.max(0, input.length - kept) : 0;
}

export function parseSavedNutritionState(raw: string | null): SavedNutritionState {
  if (!raw) return emptyNutritionState();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyNutritionState();
    const value = parsed as { schemaVersion?: unknown; days?: unknown; dayKey?: unknown; logs?: unknown; planned?: unknown; targets?: unknown; customFoods?: unknown; userMeals?: unknown; weights?: unknown };
    // Anything this build does not recognise rides along untouched. `dayKey` and
    // `logs` are schema-1 fields consumed by the migration below, and `rejected`
    // describes a load, so none of those are carried.
    const consumed = new Set([...KNOWN_STATE_KEYS, "dayKey", "logs", "rejected", "carried"] as string[]);
    const carriedEntries = Object.entries(value as Record<string, unknown>).filter(([key]) => !consumed.has(key));
    const carried = carriedEntries.length > 0 ? Object.fromEntries(carriedEntries) : undefined;

    const planned = Array.isArray(value.planned) ? value.planned.flatMap(parsePlanEntry) : [];
    const targets = parseTargets(value.targets);
    const parsedCustomFoods = Array.isArray(value.customFoods) ? value.customFoods.flatMap((food) => {
      const parsedFood = parseFood(food);
      return parsedFood ? [parsedFood] : [];
    }).slice(0, 500) : [];
    const customFoods = [...new Map(parsedCustomFoods.map((food) => [food.id, food])).values()];
    const parsedUserMeals = Array.isArray(value.userMeals) ? value.userMeals.slice(0, 5000).flatMap((meal) => {
      const parsedMeal = parseUserMeal(meal);
      return parsedMeal ? [parsedMeal] : [];
    }) : [];
    const userMeals = [...new Map(parsedUserMeals.map((meal) => [meal.id, meal])).values()].slice(-MAX_USER_MEALS);
    const weightByDate = new Map<string, WeightEntry>();
    if (Array.isArray(value.weights)) for (const entry of value.weights) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { date?: unknown; kg?: unknown };
      if (!isDateKey(candidate.date) || candidate.date > currentBangaloreDayKey() || !isWeightValueValid(candidate.kg as number)) continue;
      if (weightByDate.size >= 5000 && !weightByDate.has(candidate.date)) continue;
      weightByDate.set(candidate.date, { date: candidate.date, kg: Math.round((candidate.kg as number) * 10) / 10 });
    }
    const weights = [...weightByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
    // Duplicate ids collapse legitimately, so custom foods and meals are counted
    // against the parsed list rather than the deduplicated one.
    const droppedSoFar = countDropped(value.planned, planned.length)
      + countDropped(value.customFoods, parsedCustomFoods.length)
      + countDropped(value.userMeals, parsedUserMeals.length)
      + countDropped(value.weights, weightByDate.size);

    // Schema 1 held one day inline. Migrate it rather than discarding the diary.
    if (value.schemaVersion !== 2) {
      const dayKey = typeof value.dayKey === "string" && DAY_KEY_PATTERN.test(value.dayKey) ? value.dayKey : null;
      const logs = Array.isArray(value.logs) ? value.logs.flatMap(parseLogEntry) : [];
      return {
        schemaVersion: 2,
        days: dayKey ? normaliseDays([{ dayKey, logs }]) : [],
        planned,
        targets,
        customFoods,
        userMeals,
        weights,
        ...(carried ? { carried } : {}),
        rejected: droppedSoFar + countDropped(value.logs, logs.length),
      };
    }

    const days = Array.isArray(value.days)
      ? value.days.flatMap((entry): SavedDay[] => {
        if (!entry || typeof entry !== "object") return [];
        const candidate = entry as { dayKey?: unknown; logs?: unknown };
        if (typeof candidate.dayKey !== "string" || !DAY_KEY_PATTERN.test(candidate.dayKey)) return [];
        return [{ dayKey: candidate.dayKey, logs: Array.isArray(candidate.logs) ? candidate.logs.flatMap(parseLogEntry) : [] }];
      })
      : [];
    const keptLogs = days.reduce((sum, day) => sum + day.logs.length, 0);
    const storedLogs = Array.isArray(value.days)
      ? value.days.reduce((sum, entry) => sum + (Array.isArray((entry as { logs?: unknown })?.logs) ? ((entry as { logs: unknown[] }).logs).length : 0), 0)
      : 0;
    return {
      schemaVersion: 2,
      days: normaliseDays(days),
      planned,
      targets,
      customFoods,
      userMeals,
      weights,
      ...(carried ? { carried } : {}),
      rejected: droppedSoFar + countDropped(value.days, days.length) + Math.max(0, storedLogs - keptLogs),
    };
  } catch {
    return emptyNutritionState();
  }
}

export function stringifySavedNutritionState(state: PersistedNutritionState) {
  // `rejected` describes a load, not the diary, so the write type excludes it.
  const { schemaVersion, days, planned, targets, customFoods, userMeals, weights, carried } = state;
  // Unknown fields go down first so this build's own keys always win, but nothing
  // a newer build wrote is dropped on the way through.
  return JSON.stringify({ ...(carried ?? {}), schemaVersion, days, planned, targets, customFoods, userMeals, weights });
}

export function logsForDay(state: SavedNutritionState, dayKey: string): SavedLogEntry[] {
  return state.days.find((day) => day.dayKey === dayKey)?.logs ?? [];
}

/**
 * Replaces one day's entries, leaving every other day untouched. Writing an empty list
 * removes that day, so a day KP clears does not linger as a zero-calorie record.
 */
export function withDayLogs(state: SavedNutritionState, dayKey: string, logs: SavedLogEntry[]): SavedNutritionState {
  if (!DAY_KEY_PATTERN.test(dayKey)) return state;
  const others = state.days.filter((day) => day.dayKey !== dayKey);
  return { ...state, days: normaliseDays(logs.length > 0 ? [{ dayKey, logs }, ...others] : others) };
}

/** True when saving would push the oldest day out of storage, so the caller can say so. */
export function wouldDropOldestDay(state: SavedNutritionState, dayKey: string) {
  return state.days.length >= MAX_STORED_DAYS && !state.days.some((day) => day.dayKey === dayKey);
}

/** The narrow slice of localStorage these helpers need, so they stay testable. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

/**
 * Read the diary, newest schema first, then older keys, then the backup.
 *
 * The backup is consulted only when nothing else yields usable JSON — a live key
 * that parses is always preferred, even if the backup is newer, because the live
 * key is what the app has been writing to.
 */
export function readStoredNutritionRaw(storage: StorageLike): string | null {
  const candidates = [LOCAL_NUTRITION_STORAGE_KEY, ...LEGACY_NUTRITION_STORAGE_KEYS, NUTRITION_BACKUP_STORAGE_KEY];
  let firstPresent: string | null = null;
  for (const key of candidates) {
    let raw: string | null = null;
    try {
      raw = storage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;
    if (firstPresent === null) firstPresent = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return raw;
    } catch {
      // Unparseable: keep looking, so a corrupted live key falls back to the backup
      // instead of presenting an empty diary as if nothing had ever been logged.
    }
  }
  return firstPresent;
}

/**
 * Write the diary, then mirror it to the backup key.
 *
 * The mirror happens AFTER the live write succeeds, so the backup holds the last
 * known-good copy of everything. An earlier version kept the *previous* payload
 * instead, which sounds equivalent and is not: recovering from it silently lost
 * the most recent change. Driving a real corruption in the browser showed a
 * restored diary with zero entries, because the pre-write snapshot predated the
 * only thing that had been logged.
 *
 * The live write is allowed to throw — a save that fails must reach KP, because a
 * diary that has silently stopped recording is the worst outcome here. The mirror
 * never throws: failing to duplicate is not a reason to fail the real save.
 */
export function writeStoredNutritionState(storage: StorageLike, state: PersistedNutritionState): void {
  const next = stringifySavedNutritionState(state);
  storage.setItem(LOCAL_NUTRITION_STORAGE_KEY, next);
  try {
    storage.setItem(NUTRITION_BACKUP_STORAGE_KEY, next);
  } catch {
    // Out of quota for the duplicate. The real diary is already written, which is
    // what matters; the next successful save re-establishes the mirror.
  }
}

/** A portable snapshot KP can keep outside the browser. */
export function exportNutritionState(state: PersistedNutritionState, exportedAt: string) {
  return `${JSON.stringify({ app: "nourish", kind: "nourish-backup", version: 1, exportedAt, state: JSON.parse(stringifySavedNutritionState(state)) }, null, 2)}\n`;
}

/**
 * Read a file KP exported earlier. Returns null rather than throwing, because the
 * caller has to tell him it was not a Nourish backup instead of half-importing it.
 */
export function parseExportedNutritionState(raw: string): SavedNutritionState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const envelope = parsed as { kind?: unknown; state?: unknown };
  // Accept either the wrapped export or a bare state object, so a hand-copied
  // localStorage value is still importable.
  const candidate = envelope.kind === "nourish-backup" && envelope.state && typeof envelope.state === "object" ? envelope.state : parsed;
  const restored = parseSavedNutritionState(JSON.stringify(candidate));
  const hasContent = restored.days.length > 0 || restored.customFoods.length > 0 || restored.userMeals.length > 0 || restored.weights.length > 0 || restored.targets !== null;
  return hasContent ? restored : null;
}
