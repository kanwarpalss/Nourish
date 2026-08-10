export const LOCAL_NUTRITION_STORAGE_KEY = "nourish.nutrition.v1";

export type SavedLogEntry = {
  foodId: string;
  amount: number;
  /**
   * Only set for composite dishes. The edited component weights must be saved, otherwise a
   * chapati rolled from 45 g of atta would come back after a refresh as the 30 g default.
   */
  components?: Array<{ foodId: string; amount: number }>;
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
      const candidate = entry as { foodId?: unknown; amount?: unknown; components?: unknown };
      if (typeof candidate.foodId !== "string" || candidate.foodId.length === 0 || !Number.isFinite(candidate.amount)) return [];
      const components = Array.isArray(candidate.components) ? candidate.components.flatMap((part): Array<{ foodId: string; amount: number }> => {
        if (!part || typeof part !== "object") return [];
        const component = part as { foodId?: unknown; amount?: unknown };
        return typeof component.foodId === "string" && component.foodId.length > 0 && Number.isFinite(component.amount) && (component.amount as number) > 0
          ? [{ foodId: component.foodId, amount: component.amount as number }]
          : [];
      }) : [];
      const saved: SavedLogEntry = { foodId: candidate.foodId, amount: candidate.amount as number };
      if (components.length > 0) saved.components = components;
      return [saved];
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
