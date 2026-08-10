export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v1";

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

/**
 * Schema 2 keeps every day rather than only the current one.
 *
 * Schema 1 stored a single `{ dayKey, logs }`. When the Bangalore day rolled over, the app
 * declined to restore the previous day and then immediately autosaved the new empty day
 * over the same key, so the diary was destroyed every midnight. That also made a truthful
 * History or Trends view impossible, because no history was ever retained.
 */
export type SavedNutritionState = {
  schemaVersion: 2;
  days: SavedDay[];
  planned: SavedPlanEntry[];
  targets: SavedTargets | null;
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const emptyNutritionState = (): SavedNutritionState => ({ schemaVersion: 2, days: [], planned: [], targets: null });

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
  const candidate = entry as { foodId?: unknown; amount?: unknown; components?: unknown; override?: unknown };
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

export function parseSavedNutritionState(raw: string | null): SavedNutritionState {
  if (!raw) return emptyNutritionState();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyNutritionState();
    const value = parsed as { schemaVersion?: unknown; days?: unknown; dayKey?: unknown; logs?: unknown; planned?: unknown; targets?: unknown };
    const planned = Array.isArray(value.planned) ? value.planned.flatMap(parsePlanEntry) : [];
    const targets = parseTargets(value.targets);

    // Schema 1 held one day inline. Migrate it rather than discarding the diary.
    if (value.schemaVersion !== 2) {
      const dayKey = typeof value.dayKey === "string" && DAY_KEY_PATTERN.test(value.dayKey) ? value.dayKey : null;
      const logs = Array.isArray(value.logs) ? value.logs.flatMap(parseLogEntry) : [];
      return { schemaVersion: 2, days: dayKey ? normaliseDays([{ dayKey, logs }]) : [], planned, targets };
    }

    const days = Array.isArray(value.days)
      ? value.days.flatMap((entry): SavedDay[] => {
        if (!entry || typeof entry !== "object") return [];
        const candidate = entry as { dayKey?: unknown; logs?: unknown };
        if (typeof candidate.dayKey !== "string" || !DAY_KEY_PATTERN.test(candidate.dayKey)) return [];
        return [{ dayKey: candidate.dayKey, logs: Array.isArray(candidate.logs) ? candidate.logs.flatMap(parseLogEntry) : [] }];
      })
      : [];
    return { schemaVersion: 2, days: normaliseDays(days), planned, targets };
  } catch {
    return emptyNutritionState();
  }
}

export function stringifySavedNutritionState(state: SavedNutritionState) {
  return JSON.stringify(state);
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
