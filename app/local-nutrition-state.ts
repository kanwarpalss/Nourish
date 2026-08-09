export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v1";

export type SavedLogEntry = {
  foodId: string;
  amount: number;
};

export type SavedPlanEntry = {
  id: string;
  kind: "food" | "meal";
};

export type SavedNutritionState = {
  dayKey: string | null;
  logs: SavedLogEntry[];
  planned: SavedPlanEntry[];
};

const emptyState = (): SavedNutritionState => ({ dayKey: null, logs: [], planned: [] });

export function parseSavedNutritionState(raw: string | null): SavedNutritionState {
  if (!raw) return emptyState();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    const value = parsed as { dayKey?: unknown; logs?: unknown; planned?: unknown };
    const dayKey = typeof value.dayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.dayKey) ? value.dayKey : null;
    const logs = Array.isArray(value.logs) ? value.logs.flatMap((entry): SavedLogEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { foodId?: unknown; amount?: unknown };
      return typeof candidate.foodId === "string" && candidate.foodId.length > 0 && Number.isFinite(candidate.amount) ? [{ foodId: candidate.foodId, amount: candidate.amount }] : [];
    }) : [];
    const planned = Array.isArray(value.planned) ? value.planned.flatMap((entry): SavedPlanEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { id?: unknown; kind?: unknown };
      return typeof candidate.id === "string" && candidate.id.length > 0 && (candidate.kind === "food" || candidate.kind === "meal") ? [{ id: candidate.id, kind: candidate.kind }] : [];
    }) : [];
    return { dayKey, logs, planned };
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
