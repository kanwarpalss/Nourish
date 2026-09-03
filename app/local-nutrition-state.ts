import { MAX_MEAL_COMPONENTS, MAX_NUTRITION_VALUE, MAX_USER_MEALS, userMealTotals, type UserMeal } from "./logging-session";
import { isFoodPhotoUrl } from "./log-photos";
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
export const KNOWN_STATE_KEYS = ["schemaVersion", "days", "planned", "targets", "customFoods", "userMeals", "weights", "removed", "removalDecisions"] as const;

/**
 * How many days of diary are kept. Thirteen months so a full year of trends always has a
 * comparison period. Each entry is a few dozen bytes, so even a heavily used year is far
 * inside the browser's storage budget.
 */
export const MAX_STORED_DAYS = 400;
export const MAX_CUSTOM_FOODS = 500;
export const MAX_WEIGHT_ENTRIES = 5000;
/**
 * How many deletions are remembered per collection. Deleting is a normal, frequent
 * action, so this list has to be bounded — but it is only ids, and forgetting the
 * oldest deletion is harmless: the worst case is that a very old backup re-adds a
 * record deleted long ago, which restore already reports as an addition.
 */
export const MAX_REMOVED_IDS = 1000;

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
  /**
   * Stable identity for one logged entry, so two devices can be merged without
   * guessing. Position cannot do this job: log lunch on the phone and dinner on
   * the laptop before they sync and both are "entry 2" of the same day, so a
   * merge keyed on position drops one meal without saying so.
   *
   * Optional because every entry written before sync existed predates it. Those
   * are stamped on the next load by `withLogIds`, not invented during a parse —
   * parsing has to stay pure, or the same stored bytes would read differently
   * each time.
   */
  logId?: string;
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
  /** Resolves edits made on different devices without letting a stale browser win. */
  updatedAt?: number;
};

export const MAX_TARGET_VALUE = 50_000;

/** A newly saved target must outrank the last one even when device clocks disagree. */
export function nextTargetEditTime(previous?: number, now = Date.now()) {
  const prior = Number.isSafeInteger(previous) && (previous as number) >= 0 ? previous as number : 0;
  const wallTime = Number.isSafeInteger(now) && now >= 0 ? now : 0;
  return prior >= Number.MAX_SAFE_INTEGER ? prior : Math.max(wallTime, prior + 1);
}

export type WeightEntry = { date: string; kg: number };

/**
 * What KP has deliberately deleted, remembered by id.
 *
 * Restore is deliberately additive — on a collision what is already here wins and
 * nothing is removed (that rule is why a stale backup can never undo today's work).
 * The gap that leaves is deletion: without a record of it, importing any older
 * backup silently resurrects every meal, food and weigh-in KP has ever removed.
 * A deletion is a decision, so it has to be stored as one.
 */
export type RemovedRecords = {
  customFoods: string[];
  userMeals: string[];
  days: string[];
  weights: string[];
  logs: string[];
};

/** The collections a record can be deleted from, and what identifies a record in each. */
export type RemovableKind = "customFood" | "userMeal" | "weight" | "day";
type RemovalKind = RemovableKind | "log";

/**
 * The latest deliberate decision for a record. A plain tombstone can say only
 * "deleted"; it cannot represent a later Undo when another device still has
 * the earlier deletion. The timestamp makes delete and restore commutative
 * across sync: whichever decision happened last wins.
 */
export type RemovalDecision = { removed: boolean; at: number };
export type RemovalDecisions = Record<keyof RemovedRecords, Record<string, RemovalDecision>>;

/**
 * A deleted record, complete enough to put back exactly as it was. Returned by
 * `removeRecord` so the caller can offer Undo without re-reading storage.
 */
export type RemovedRecord =
  | { kind: "customFood"; food: NutritionItem; planned: Array<{ entry: SavedPlanEntry; index: number }> }
  | { kind: "userMeal"; meal: UserMeal }
  | { kind: "weight"; entry: WeightEntry }
  | { kind: "day"; day: SavedDay };

const REMOVED_KEYS: Record<RemovalKind, keyof RemovedRecords> = {
  customFood: "customFoods",
  userMeal: "userMeals",
  weight: "weights",
  day: "days",
  log: "logs",
};

export const emptyRemovedRecords = (): RemovedRecords => ({ customFoods: [], userMeals: [], days: [], weights: [], logs: [] });
export const emptyRemovalDecisions = (): RemovalDecisions => ({ customFoods: {}, userMeals: {}, days: {}, weights: {}, logs: {} });

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
  /** Ids KP deleted on purpose, so a restore cannot bring them back. */
  removed: RemovedRecords;
  /** Durable delete/restore ordering, so Undo also survives a cross-device sync. */
  removalDecisions: RemovalDecisions;
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

export const emptyNutritionState = (): SavedNutritionState => ({ schemaVersion: 2, days: [], planned: [], targets: null, customFoods: [], userMeals: [], weights: [], removed: emptyRemovedRecords(), removalDecisions: emptyRemovalDecisions(), rejected: 0 });

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
  // A photo KP took of his own food has no scheme or host, so `new URL()` below
  // would reject it. Allow only the exact diary route which owns food photos;
  // a broad API prefix would let unrelated same-origin endpoints become images.
  if (isFoodPhotoUrl(value)) return true;
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
  const logId = (candidate as { logId?: unknown }).logId;
  if (typeof logId === "string" && logId.trim() && logId.length <= 64) saved.logId = logId.trim();
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
    if (!Number.isFinite(raw) || (raw as number) <= 0 || (raw as number) > MAX_TARGET_VALUE) return null;
    parsed[field] = raw as number;
  }
  const updatedAt = candidate.updatedAt;
  return Number.isSafeInteger(updatedAt) && (updatedAt as number) >= 0 ? { ...parsed, updatedAt: updatedAt as number } : parsed;
}

/**
 * A tombstone list is only ever ids. A malformed one loses the deletion record,
 * never the diary, so bad entries are dropped rather than failing the whole load.
 */
function parseRemovedIds(value: unknown, isValidId: (id: string) => boolean): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is string => typeof id === "string" && isValidId(id));
  return [...new Set(ids)].slice(-MAX_REMOVED_IDS);
}

function parseRemovedRecords(value: unknown): RemovedRecords {
  if (!value || typeof value !== "object") return emptyRemovedRecords();
  const candidate = value as Partial<Record<keyof RemovedRecords, unknown>>;
  const isId = (id: string) => id.length > 0 && id.length <= 200;
  return {
    customFoods: parseRemovedIds(candidate.customFoods, isId),
    userMeals: parseRemovedIds(candidate.userMeals, isId),
    days: parseRemovedIds(candidate.days, isDateKey),
    weights: parseRemovedIds(candidate.weights, isDateKey),
    logs: parseRemovedIds(candidate.logs, isId),
  };
}

function emptyRemovalDecisionEntries(): Record<string, RemovalDecision> {
  return {};
}

function parseRemovalDecisionEntries(value: unknown, isValidId: (id: string) => boolean): Record<string, RemovalDecision> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyRemovalDecisionEntries();
  const parsed = Object.entries(value).flatMap(([id, candidate]) => {
    if (!isValidId(id) || !candidate || typeof candidate !== "object") return [];
    const decision = candidate as { removed?: unknown; at?: unknown };
    if (typeof decision.removed !== "boolean" || !Number.isSafeInteger(decision.at) || decision.at < 0) return [];
    return [[id, { removed: decision.removed, at: decision.at }] as const];
  });
  return Object.fromEntries(parsed.sort((left, right) => left[1].at - right[1].at).slice(-MAX_REMOVED_IDS));
}

function parseRemovalDecisions(value: unknown): RemovalDecisions {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<RemovalDecisions> : {};
  const isId = (id: string) => id.length > 0 && id.length <= 200;
  return {
    customFoods: parseRemovalDecisionEntries(candidate.customFoods, isId),
    userMeals: parseRemovalDecisionEntries(candidate.userMeals, isId),
    days: parseRemovalDecisionEntries(candidate.days, isDateKey),
    weights: parseRemovalDecisionEntries(candidate.weights, isDateKey),
    logs: parseRemovalDecisionEntries(candidate.logs, isId),
  };
}

function withLegacyRemovalDecisions(removed: RemovedRecords, decisions: RemovalDecisions): RemovalDecisions {
  const result: RemovalDecisions = { ...decisions, customFoods: { ...decisions.customFoods }, userMeals: { ...decisions.userMeals }, days: { ...decisions.days }, weights: { ...decisions.weights }, logs: { ...decisions.logs } };
  for (const kind of Object.keys(REMOVED_KEYS) as RemovalKind[]) {
    const key = REMOVED_KEYS[kind];
    for (const id of removed[key]) result[key][id] ??= { removed: true, at: 0 };
  }
  return result;
}

function removedFromDecisions(decisions: RemovalDecisions): RemovedRecords {
  const result = emptyRemovedRecords();
  for (const kind of Object.keys(REMOVED_KEYS) as RemovalKind[]) {
    const key = REMOVED_KEYS[kind];
    result[key] = Object.entries(decisions[key]).filter(([, decision]) => decision.removed).map(([id]) => id).slice(-MAX_REMOVED_IDS);
  }
  return result;
}

/** Newest first, one entry per day, capped. Empty days are dropped so they cannot masquerade as fasted days. */
function normaliseDays(days: SavedDay[]): SavedDay[] {
  const byKey = new Map<string, SavedDay>();
  const today = currentBangaloreDayKey();
  for (const day of days) {
    if (!isDateKey(day.dayKey) || day.dayKey > today || day.logs.length === 0) continue;
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
    const value = parsed as { schemaVersion?: unknown; days?: unknown; dayKey?: unknown; logs?: unknown; planned?: unknown; targets?: unknown; customFoods?: unknown; userMeals?: unknown; weights?: unknown; removed?: unknown; removalDecisions?: unknown };
    // Anything this build does not recognise rides along untouched. `dayKey` and
    // `logs` are schema-1 fields consumed by the migration below, and `rejected`
    // describes a load, so none of those are carried.
    const consumed = new Set([...KNOWN_STATE_KEYS, "dayKey", "logs", "rejected", "carried"] as string[]);
    const carriedEntries = Object.entries(value as Record<string, unknown>).filter(([key]) => !consumed.has(key));
    const carried = carriedEntries.length > 0 ? Object.fromEntries(carriedEntries) : undefined;
    const today = currentBangaloreDayKey();

    const planned = Array.isArray(value.planned) ? value.planned.flatMap(parsePlanEntry) : [];
    const targets = parseTargets(value.targets);
    const parsedCustomFoods = Array.isArray(value.customFoods) ? value.customFoods.flatMap((food) => {
      const parsedFood = parseFood(food);
      return parsedFood ? [parsedFood] : [];
    }).slice(0, MAX_CUSTOM_FOODS) : [];
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
      if (!isDateKey(candidate.date) || candidate.date > today || !isWeightValueValid(candidate.kg as number)) continue;
      if (weightByDate.size >= MAX_WEIGHT_ENTRIES && !weightByDate.has(candidate.date)) continue;
      weightByDate.set(candidate.date, { date: candidate.date, kg: Math.round((candidate.kg as number) * 10) / 10 });
    }
    const weights = [...weightByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
    const legacyRemoved = parseRemovedRecords(value.removed);
    const removalDecisions = withLegacyRemovalDecisions(legacyRemoved, parseRemovalDecisions(value.removalDecisions));
    const removed = removedFromDecisions(removalDecisions);
    // Duplicate ids collapse legitimately, so custom foods and meals are counted
    // against the parsed list rather than the deduplicated one.
    const droppedSoFar = countDropped(value.planned, planned.length)
      + countDropped(value.customFoods, parsedCustomFoods.length)
      + countDropped(value.userMeals, parsedUserMeals.length)
      + countDropped(value.weights, weightByDate.size);

    // Schema 1 held one day inline. Migrate it rather than discarding the diary.
    if (value.schemaVersion !== 2) {
      const dayKey = isDateKey(value.dayKey) && value.dayKey <= today ? value.dayKey : null;
      const logs = Array.isArray(value.logs) ? value.logs.flatMap(parseLogEntry) : [];
      return {
        schemaVersion: 2,
        days: dayKey ? normaliseDays([{ dayKey, logs }]) : [],
        planned,
        targets,
        customFoods,
        userMeals,
        weights,
        removed,
        removalDecisions,
        ...(carried ? { carried } : {}),
        rejected: droppedSoFar + countDropped(value.logs, logs.length),
      };
    }

    const days = Array.isArray(value.days)
      ? value.days.flatMap((entry): SavedDay[] => {
        if (!entry || typeof entry !== "object") return [];
        const candidate = entry as { dayKey?: unknown; logs?: unknown };
        if (!isDateKey(candidate.dayKey) || candidate.dayKey > today) return [];
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
      removed,
      removalDecisions,
      ...(carried ? { carried } : {}),
      rejected: droppedSoFar + countDropped(value.days, days.length) + Math.max(0, storedLogs - keptLogs),
    };
  } catch {
    return emptyNutritionState();
  }
}

export function stringifySavedNutritionState(state: PersistedNutritionState) {
  // `rejected` describes a load, not the diary, so the write type excludes it.
  const { schemaVersion, days, planned, targets, customFoods, userMeals, weights, removed, removalDecisions, carried } = state;
  // Unknown fields go down first so this build's own keys always win, but nothing
  // a newer build wrote is dropped on the way through.
  return JSON.stringify({ ...(carried ?? {}), schemaVersion, days, planned, targets, customFoods, userMeals, weights, removed, removalDecisions });
}

export function logsForDay(state: SavedNutritionState, dayKey: string): SavedLogEntry[] {
  return state.days.find((day) => day.dayKey === dayKey)?.logs ?? [];
}

/**
 * Replaces one day's entries, leaving every other day untouched. Writing an empty list
 * removes that day, so a day KP clears does not linger as a zero-calorie record.
 */
export function withDayLogs(state: SavedNutritionState, dayKey: string, logs: SavedLogEntry[]): SavedNutritionState {
  if (!isDateKey(dayKey) || dayKey > currentBangaloreDayKey()) return state;
  const previousLogs = logsForDay(state, dayKey);
  const nextLogIds = new Set(logs.flatMap((log) => log.logId ? [log.logId] : []));
  const others = state.days.filter((day) => day.dayKey !== dayKey);
  let next = {
    ...state,
    days: normaliseDays(logs.length > 0 ? [{ dayKey, logs }, ...others] : others),
  };
  // A diary-entry deletion needs its own durable decision. Otherwise sync's
  // log-id union faithfully brings the removed entry back from another device.
  for (const log of previousLogs) {
    if (log.logId && !nextLogIds.has(log.logId)) next = withRemovalDecision(next, "log", log.logId, true);
  }
  // Undo (or deliberately reusing a previously removed snapshot) is also an
  // ordered decision, so an older remote delete cannot win on the next sync.
  for (const log of logs) {
    if (log.logId && state.removalDecisions.logs?.[log.logId]?.removed) next = withRemovalDecision(next, "log", log.logId, false);
  }
  // Logging on a day KP had deleted is a deliberate restore. Keep that later
  // decision, otherwise a device holding the earlier deletion would erase it.
  return logs.length > 0 ? withRemovalDecision(next, "day", dayKey, false) : next;
}

function nextDecisionTime(state: SavedNutritionState, kind: RemovalKind, id: string) {
  const previous = state.removalDecisions[REMOVED_KEYS[kind]][id]?.at ?? 0;
  return Math.max(Date.now(), previous + 1);
}

function withRemovalDecision(state: SavedNutritionState, kind: RemovalKind, id: string, removed: boolean): SavedNutritionState {
  const key = REMOVED_KEYS[kind];
  const decisions = {
    ...state.removalDecisions,
    [key]: { ...state.removalDecisions[key], [id]: { removed, at: nextDecisionTime(state, kind, id) } },
  } as RemovalDecisions;
  const limited = {
    ...decisions,
    [key]: Object.fromEntries(Object.entries(decisions[key]).sort((left, right) => left[1].at - right[1].at).slice(-MAX_REMOVED_IDS)),
  } as RemovalDecisions;
  return { ...state, removalDecisions: limited, removed: removedFromDecisions(limited) };
}

/** True when KP deleted this record here, so a restore must not put it back. */
export function isRemoved(removed: RemovedRecords, kind: RemovalKind, id: string) {
  return removed[REMOVED_KEYS[kind]].includes(id);
}

/** Undo must never evict an unrelated item just because a list is full. */
export function canRestoreRecord(state: SavedNutritionState, record: RemovedRecord) {
  if (record.kind === "customFood") return state.customFoods.some((food) => food.id === record.food.id) || state.customFoods.length < MAX_CUSTOM_FOODS;
  if (record.kind === "userMeal") return state.userMeals.some((meal) => meal.id === record.meal.id) || state.userMeals.length < MAX_USER_MEALS;
  return true;
}

/**
 * Delete one record and hand back what was deleted.
 *
 * Returning the record is what makes Undo possible without a second read: the
 * caller holds the only copy until KP either uses Undo or lets the toast go. A
 * record that is not there is not an error — it returns the state untouched and
 * a null, so a double tap cannot tombstone something it did not remove.
 */
export function removeRecord(state: SavedNutritionState, kind: RemovableKind, id: string): { state: SavedNutritionState; removed: RemovedRecord | null } {
  if (kind === "customFood") {
    const food = state.customFoods.find((candidate) => candidate.id === id);
    if (!food) return { state, removed: null };
    const planned = state.planned.flatMap((entry, index) => entry.kind === "food" && entry.id === id ? [{ entry, index }] : []);
    return {
      state: withRemovalDecision({
        ...state,
        customFoods: state.customFoods.filter((candidate) => candidate.id !== id),
        // A plan entry pointing at a food that no longer exists is already invisible,
        // but leaving it stored means the draft silently repopulates if the id ever
        // comes back. Deleting the food deletes the plan line that named it.
        planned: state.planned.filter((entry) => !(entry.kind === "food" && entry.id === id)),
      }, kind, id, true),
      removed: { kind, food, planned },
    };
  }
  if (kind === "userMeal") {
    const meal = state.userMeals.find((candidate) => candidate.id === id);
    if (!meal) return { state, removed: null };
    return { state: withRemovalDecision({ ...state, userMeals: state.userMeals.filter((candidate) => candidate.id !== id) }, kind, id, true), removed: { kind, meal } };
  }
  if (kind === "weight") {
    const entry = state.weights.find((candidate) => candidate.date === id);
    if (!entry) return { state, removed: null };
    return { state: withRemovalDecision({ ...state, weights: state.weights.filter((candidate) => candidate.date !== id) }, kind, id, true), removed: { kind, entry } };
  }
  const day = state.days.find((candidate) => candidate.dayKey === id);
  if (!day) return { state, removed: null };
  return { state: withRemovalDecision({ ...state, days: state.days.filter((candidate) => candidate.dayKey !== id) }, kind, id, true), removed: { kind, day } };
}

/** Put a deleted record back exactly as it was, and forget that it was ever deleted. */
export function restoreRecord(state: SavedNutritionState, record: RemovedRecord): SavedNutritionState {
  if (!canRestoreRecord(state, record)) return state;
  if (record.kind === "customFood") {
    const planned = [...state.planned];
    for (const { entry, index } of record.planned) planned.splice(Math.min(index, planned.length), 0, entry);
    return withRemovalDecision({ ...state, customFoods: [...state.customFoods.filter((food) => food.id !== record.food.id), record.food], planned }, "customFood", record.food.id, false);
  }
  if (record.kind === "userMeal") {
    return withRemovalDecision({ ...state, userMeals: [...state.userMeals.filter((meal) => meal.id !== record.meal.id), record.meal] }, "userMeal", record.meal.id, false);
  }
  if (record.kind === "weight") {
    return withRemovalDecision({ ...state, weights: upsertWeightEntry(state.weights, record.entry) }, "weight", record.entry.date, false);
  }
  return withRemovalDecision({ ...state, days: normaliseDays([record.day, ...state.days.filter((day) => day.dayKey !== record.day.dayKey)]) }, "day", record.day.dayKey, false);
}

/**
 * A genuine fresh start: every diary day, food, meal, weigh-in and target goes,
 * and so does the record of what was deleted.
 *
 * Keeping the tombstones would make this button permanent in a way KP would not
 * expect — a later restore from his own backup would come back empty, because
 * every id in the file would be marked deleted. Anything he does not want back
 * he can delete again; a reset he cannot undo from a backup is a trap.
 * Fields this build does not recognise are carried through untouched, because
 * clearing this build's data is not licence to delete another build's.
 */
export function clearAllUserData(state: SavedNutritionState): SavedNutritionState {
  return { ...emptyNutritionState(), ...(state.carried ? { carried: state.carried } : {}), rejected: 0 };
}

/** True when saving would push the oldest day out of storage, so the caller can say so. */
export function wouldDropOldestDay(state: SavedNutritionState, dayKey: string) {
  return state.days.length >= MAX_STORED_DAYS && !state.days.some((day) => day.dayKey === dayKey);
}

type BackupMergeCounts = {
  days: number;
  customFoods: number;
  userMeals: number;
  weights: number;
  targets: number;
};

function mergeCollection<T>(current: T[], restored: T[], key: (item: T) => string, limit: number, isDeleted: (id: string) => boolean = () => false) {
  const occupied = new Set(current.map(key));
  const room = Math.max(0, limit - current.length);
  const notColliding = restored.filter((item) => !occupied.has(key(item)));
  const available = notColliding.filter((item) => !isDeleted(key(item)));
  const additions = available.slice(0, room);
  return {
    additions,
    collisions: restored.length - notColliding.length,
    skippedAsDeleted: notColliding.length - available.length,
    skippedAtCapacity: available.length - additions.length,
  };
}

/**
 * Add non-conflicting backup records without ever evicting live browser data.
 * Current records win every collision. At a storage cap, the backup simply has
 * no room; exceeding a cap here would only make the next reload discard data.
 */
export function mergeNutritionBackup(current: SavedNutritionState, restored: SavedNutritionState): { state: SavedNutritionState; added: BackupMergeCounts; collisions: BackupMergeCounts; skippedAsDeleted: BackupMergeCounts; skippedAtCapacity: BackupMergeCounts } {
  const restoredDays = restored.days.flatMap((day) => {
    const logs = day.logs.filter((log) => !log.logId || !isRemoved(current.removed, "log", log.logId));
    return logs.length > 0 ? [{ ...day, logs }] : [];
  });
  const daysSuppressedByLogDeletes = restored.days.length - restoredDays.length;
  const days = mergeCollection(current.days, restoredDays, (day) => day.dayKey, MAX_STORED_DAYS, (id) => isRemoved(current.removed, "day", id));
  const customFoods = mergeCollection(current.customFoods, restored.customFoods, (food) => food.id, MAX_CUSTOM_FOODS, (id) => isRemoved(current.removed, "customFood", id));
  const userMeals = mergeCollection(current.userMeals, restored.userMeals, (meal) => meal.id, MAX_USER_MEALS, (id) => isRemoved(current.removed, "userMeal", id));
  const weights = mergeCollection(current.weights, restored.weights, (entry) => entry.date, MAX_WEIGHT_ENTRIES, (id) => isRemoved(current.removed, "weight", id));
  const targets = current.targets === null && restored.targets !== null ? 1 : 0;
  return {
    state: {
      ...current,
      days: [...current.days, ...days.additions].sort((left, right) => right.dayKey.localeCompare(left.dayKey)),
      customFoods: [...current.customFoods, ...customFoods.additions],
      userMeals: [...current.userMeals, ...userMeals.additions],
      weights: [...current.weights, ...weights.additions].sort((left, right) => left.date.localeCompare(right.date)),
      targets: current.targets ?? restored.targets,
      // Only this browser's own deletions survive the merge. Importing the file's
      // tombstones would let a backup delete records that are here now, which is
      // exactly what "restore never removes anything" exists to prevent.
      removed: current.removed,
      removalDecisions: current.removalDecisions,
      carried: { ...(restored.carried ?? {}), ...(current.carried ?? {}) },
    },
    added: { days: days.additions.length, customFoods: customFoods.additions.length, userMeals: userMeals.additions.length, weights: weights.additions.length, targets },
    collisions: { days: days.collisions, customFoods: customFoods.collisions, userMeals: userMeals.collisions, weights: weights.collisions, targets: current.targets !== null && restored.targets !== null ? 1 : 0 },
    skippedAsDeleted: { days: days.skippedAsDeleted + daysSuppressedByLogDeletes, customFoods: customFoods.skippedAsDeleted, userMeals: userMeals.skippedAsDeleted, weights: weights.skippedAsDeleted, targets: 0 },
    skippedAtCapacity: { days: days.skippedAtCapacity, customFoods: customFoods.skippedAtCapacity, userMeals: userMeals.skippedAtCapacity, weights: weights.skippedAtCapacity, targets: 0 },
  };
}

/**
 * Give every logged entry a stable id, leaving the ones that already have one alone.
 *
 * Runs on load rather than inside the parser, because a parse must return the same
 * thing every time it sees the same bytes. A duplicate id is treated as missing —
 * two entries claiming the same identity would collapse into one on the next sync.
 */
export function withLogIds(state: SavedNutritionState, makeId: () => string): SavedNutritionState {
  const seen = new Set<string>();
  let changed = false;
  const days = state.days.map((day) => ({
    ...day,
    logs: day.logs.map((log) => {
      if (log.logId && !seen.has(log.logId)) {
        seen.add(log.logId);
        return log;
      }
      let id = makeId();
      while (seen.has(id)) id = makeId();
      seen.add(id);
      changed = true;
      return { ...log, logId: id };
    }),
  }));
  return changed ? { ...state, days } : state;
}

function mergeRemovalDecisionEntries(left: Record<string, RemovalDecision>, right: Record<string, RemovalDecision>) {
  const merged: Record<string, RemovalDecision> = { ...right };
  for (const [id, decision] of Object.entries(left)) {
    const other = merged[id];
    // A tie is extraordinarily rare (two taps in the same millisecond). Keeping
    // deletion in that tie is the safe side: it cannot silently resurrect data.
    if (!other || decision.at > other.at || (decision.at === other.at && decision.removed && !other.removed)) merged[id] = decision;
  }
  return Object.fromEntries(Object.entries(merged).sort((a, b) => a[1].at - b[1].at).slice(-MAX_REMOVED_IDS));
}

function mergeRemovalDecisions(local: RemovalDecisions, remote: RemovalDecisions): RemovalDecisions {
  return {
    customFoods: mergeRemovalDecisionEntries(local.customFoods, remote.customFoods),
    userMeals: mergeRemovalDecisionEntries(local.userMeals, remote.userMeals),
    days: mergeRemovalDecisionEntries(local.days, remote.days),
    weights: mergeRemovalDecisionEntries(local.weights, remote.weights),
    logs: mergeRemovalDecisionEntries(local.logs, remote.logs),
  };
}

function unionRecords<T>(local: T[], remote: T[], key: (item: T) => string, deleted: Set<string>) {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(key(item), item);
  // Local wins a collision: it is the copy in front of whoever is looking at it.
  for (const item of local) byId.set(key(item), item);
  return [...byId.values()].filter((item) => !deleted.has(key(item)));
}

/** The most recently edited per-person target wins; legacy targets retain local-first behaviour. */
function mergeTargets(local: SavedTargets | null, remote: SavedTargets | null) {
  if (!local) return remote;
  if (!remote) return local;
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}

/**
 * Combine this device's diary with the one on the Mac Mini.
 *
 * This is deliberately NOT `mergeNutritionBackup`. Restoring a file is a one-way,
 * additive operation where the file has no authority to delete anything. Syncing is
 * two-way between copies of the same diary, so a deletion made on the phone has to
 * reach the laptop — otherwise every sync would resurrect it, which is the same
 * zombie problem tombstones exist to solve, just from the other direction.
 *
 * Nothing is ever dropped for being in conflict: within a day, entries are unioned
 * by id and only genuine duplicates collapse. Where a day predates entry ids, the
 * side holding more entries wins outright, because half a day's food is a worse
 * answer than a stale one.
 */
export function mergeSyncedStates(local: SavedNutritionState, remote: SavedNutritionState): SavedNutritionState {
  const removalDecisions = mergeRemovalDecisions(
    withLegacyRemovalDecisions(local.removed, local.removalDecisions),
    withLegacyRemovalDecisions(remote.removed, remote.removalDecisions),
  );
  const removed = removedFromDecisions(removalDecisions);
  const deleted = {
    customFoods: new Set(removed.customFoods),
    userMeals: new Set(removed.userMeals),
    days: new Set(removed.days),
    weights: new Set(removed.weights),
    logs: new Set(removed.logs),
  };

  const remoteDays = new Map(remote.days.map((day) => [day.dayKey, day]));
  const mergedDays = local.days.map((day) => {
    const other = remoteDays.get(day.dayKey);
    if (!other) return { ...day, logs: day.logs.filter((log) => !log.logId || !deleted.logs.has(log.logId)) };
    remoteDays.delete(day.dayKey);
    const localLogs = day.logs.filter((log) => !log.logId || !deleted.logs.has(log.logId));
    const remoteLogs = other.logs.filter((log) => !log.logId || !deleted.logs.has(log.logId));
    const identified = [...localLogs, ...remoteLogs].every((log) => Boolean(log.logId));
    if (!identified) return localLogs.length >= remoteLogs.length ? { ...day, logs: localLogs } : { ...other, logs: remoteLogs };
    const mine = new Set(localLogs.map((log) => log.logId));
    return { ...day, logs: [...localLogs, ...remoteLogs.filter((log) => !mine.has(log.logId))] };
  });

  const remainingRemoteDays = [...remoteDays.values()].map((day) => ({
    ...day,
    logs: day.logs.filter((log) => !log.logId || !deleted.logs.has(log.logId)),
  }));

  return {
    ...local,
    days: normaliseDays([...mergedDays, ...remainingRemoteDays].filter((day) => !deleted.days.has(day.dayKey))),
    customFoods: unionRecords(local.customFoods, remote.customFoods, (food) => food.id, deleted.customFoods).slice(0, MAX_CUSTOM_FOODS),
    userMeals: unionRecords(local.userMeals, remote.userMeals, (meal) => meal.id, deleted.userMeals).slice(-MAX_USER_MEALS),
    weights: unionRecords(local.weights, remote.weights, (entry) => entry.date, deleted.weights)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-MAX_WEIGHT_ENTRIES),
    // The plan draft is today's scratch pad on one device, not shared state.
    planned: local.planned,
    targets: mergeTargets(local.targets, remote.targets),
    removed,
    removalDecisions,
    carried: { ...(remote.carried ?? {}), ...(local.carried ?? {}) },
  };
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
/**
 * Which storage keys belong to which person.
 *
 * The first profile deliberately keeps the original, unsuffixed keys. That is
 * what makes the existing diary become KP's the moment profiles arrive: no
 * migration step to get wrong, nothing to copy, and an older build reading the
 * same browser still finds exactly what it wrote.
 */
export function nutritionStorageKeys(profileId?: string): { live: string; backup: string; legacy: readonly string[] } {
  if (!profileId || profileId === FIRST_PROFILE_ID) {
    return { live: LOCAL_NUTRITION_STORAGE_KEY, backup: NUTRITION_BACKUP_STORAGE_KEY, legacy: LEGACY_NUTRITION_STORAGE_KEYS };
  }
  return { live: `${LOCAL_NUTRITION_STORAGE_KEY}:${profileId}`, backup: `${NUTRITION_BACKUP_STORAGE_KEY}:${profileId}`, legacy: [] };
}

/** Kept here rather than imported, so the storage layer has no dependency on the sync layer. */
export const FIRST_PROFILE_ID = "kp";

export function readStoredNutritionRaw(storage: StorageLike, keys = nutritionStorageKeys()): string | null {
  const candidates = [keys.live, ...keys.legacy, keys.backup];
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
export function writeStoredNutritionState(storage: StorageLike, state: PersistedNutritionState, keys = nutritionStorageKeys()): void {
  const next = stringifySavedNutritionState(state);
  storage.setItem(keys.live, next);
  try {
    storage.setItem(keys.backup, next);
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
