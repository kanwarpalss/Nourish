import { buildCompositeItem, findCompositeByLogId } from "./composite-foods";
import { meals, nutritionItems, SOURCE_LINKS, type NutritionItem } from "./nutrition-data";
import { isQuantityValid, scaleNutrition } from "./prototype-logic";
import type { SavedDay, SavedLogEntry } from "./local-nutrition-state";

/**
 * Meals are loggable as one-serving foods. Kept here so both the logger and the history
 * resolver read from the same list and cannot disagree about what an id means.
 */
export const loggableMeals: NutritionItem[] = meals.map((meal) => ({
  id: `meal-${meal.id}`,
  name: meal.name,
  amount: 1,
  unit: "serving",
  calories: meal.calories,
  protein: meal.protein,
  carbs: meal.carbs,
  fat: meal.fat,
  fiber: meal.fiber,
  category: "Meal",
  availability: meal.serving,
  aliases: meal.tags,
  source: { label: "Calculated from weighed ingredients", url: SOURCE_LINKS.ifct, trust: "Reference" },
}));

/**
 * Turns one stored entry back into the food it recorded.
 *
 * Composites are rebuilt from the component weights KP actually used. An entry naming a
 * food that no longer exists resolves to null and is skipped rather than counted as zero,
 * so a removed catalogue item cannot quietly shrink a past day's totals.
 */
export function resolveLoggedFood(entry: SavedLogEntry, catalogue: NutritionItem[]): NutritionItem | null {
  const composite = findCompositeByLogId(entry.foodId);
  const food = composite
    ? buildCompositeItem(composite, entry.components?.length ? entry.components : composite.components)
    : catalogue.find((candidate) => candidate.id === entry.foodId);
  if (!food || !isQuantityValid(food.unit, entry.amount)) return null;
  return scaleNutrition(food, entry.amount);
}

export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type DaySummary = DayTotals & {
  dayKey: string;
  /** Entries that resolved. */
  entryCount: number;
  /** Entries whose food is no longer in the catalogue, so the totals are known to be short. */
  unresolvedCount: number;
};

const emptyTotals = (): DayTotals => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
const round = (value: number) => Math.round(value * 100) / 100;

export function summariseDay(day: SavedDay, catalogue: NutritionItem[] = [...nutritionItems, ...loggableMeals]): DaySummary {
  let entryCount = 0;
  let unresolvedCount = 0;
  const totals = day.logs.reduce((sum, entry) => {
    const food = resolveLoggedFood(entry, catalogue);
    if (!food) {
      unresolvedCount += 1;
      return sum;
    }
    entryCount += 1;
    return {
      calories: sum.calories + food.calories,
      protein: sum.protein + food.protein,
      carbs: sum.carbs + food.carbs,
      fat: sum.fat + food.fat,
      fiber: sum.fiber + food.fiber,
    };
  }, emptyTotals());
  return {
    dayKey: day.dayKey,
    calories: round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber),
    entryCount,
    unresolvedCount,
  };
}

/** Newest first, matching how days are stored. */
export function summariseHistory(days: SavedDay[], catalogue?: NutritionItem[]): DaySummary[] {
  return days.map((day) => summariseDay(day, catalogue)).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

export type TrendWindow = {
  /** Days in the window that actually have entries. A day with no diary is not a zero-calorie day. */
  loggedDays: number;
  /** Calendar days the window spans. */
  windowDays: number;
  /** Averages across logged days only, or null when nothing was logged. */
  average: DayTotals | null;
  /** Logged days landing within tolerance of the calorie target, or null without a target. */
  daysOnTarget: number | null;
};

/**
 * Averages over logged days only.
 *
 * SPEC 4.6 is explicit that missing days are labelled, not treated as zero intake. Dividing
 * by calendar days instead of logged days would drag every average down and quietly invent
 * a fast on every day KP forgot to open the app.
 */
export function summariseTrend(summaries: DaySummary[], windowDays: number, targetCalories: number | null, tolerance = 0.08): TrendWindow {
  const logged = summaries.slice(0, windowDays).filter((day) => day.entryCount > 0);
  if (logged.length === 0) return { loggedDays: 0, windowDays, average: null, daysOnTarget: null };
  const sum = logged.reduce((acc, day) => ({
    calories: acc.calories + day.calories,
    protein: acc.protein + day.protein,
    carbs: acc.carbs + day.carbs,
    fat: acc.fat + day.fat,
    fiber: acc.fiber + day.fiber,
  }), emptyTotals());
  const average = {
    calories: round(sum.calories / logged.length),
    protein: round(sum.protein / logged.length),
    carbs: round(sum.carbs / logged.length),
    fat: round(sum.fat / logged.length),
    fiber: round(sum.fiber / logged.length),
  };
  const daysOnTarget = targetCalories && targetCalories > 0
    ? logged.filter((day) => Math.abs(day.calories - targetCalories) <= targetCalories * tolerance).length
    : null;
  return { loggedDays: logged.length, windowDays, average, daysOnTarget };
}

/** The last `count` Bangalore day keys ending at `endDayKey`, oldest first. */
export function recentDayKeys(endDayKey: string, count: number): string[] {
  const end = new Date(`${endDayKey}T00:00:00Z`);
  if (Number.isNaN(end.getTime()) || !Number.isFinite(count) || count <= 0) return [];
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(end.getTime() - offset * 24 * 60 * 60 * 1000);
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

export const DEFAULT_TARGETS = { calories: 2150, protein: 150, carbs: 215, fat: 72 };
