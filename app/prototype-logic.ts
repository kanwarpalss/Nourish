export type MacroTargets = {
  protein: number;
  carbs: number;
  fat: number;
};

export type SearchableRecipe = {
  name: string;
  tags: string[];
  description: string;
  ingredients: string[];
  time: string;
  totalMinutes: number;
};

export type DashboardClock = {
  dayKey: string;
  dateLabel: string;
  greeting: "Good morning" | "Good afternoon" | "Good evening" | "Good night";
};

export function getBangaloreClock(date: Date): DashboardClock {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError("Dashboard clock needs a valid date");
  const timeZone = "Asia/Kolkata";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date));
  const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((item) => item.type === type)?.value ?? "";
  const keyParts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  const keyPart = (type: Intl.DateTimeFormatPartTypes) => keyParts.find((item) => item.type === type)?.value ?? "";
  const greeting = hour >= 5 && hour < 12 ? "Good morning"
    : hour >= 12 && hour < 17 ? "Good afternoon"
      : hour >= 17 && hour < 22 ? "Good evening"
        : "Good night";
  return {
    dayKey: `${keyPart("year")}-${keyPart("month")}-${keyPart("day")}`,
    dateLabel: `${part("weekday")} · ${part("day")} ${part("month")}`,
    greeting,
  };
}

const macroRanges: Record<keyof MacroTargets, [number, number]> = {
  protein: [10, 60],
  carbs: [10, 70],
  fat: [10, 60],
};

function isWithin(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function isMealBriefValid(calories: number, macros: MacroTargets) {
  const macroTotal = macros.protein + macros.carbs + macros.fat;
  return isWithin(calories, 1200, 4500)
    && Object.entries(macros).every(([key, value]) => {
      const [min, max] = macroRanges[key as keyof MacroTargets];
      return isWithin(value, min, max);
    })
    && macroTotal === 100;
}

export function getMealIndices(mealCount: number) {
  if (mealCount === 3) return [0, 2, 4];
  if (mealCount === 4) return [0, 2, 3, 4];
  if (mealCount === 5) return [0, 1, 2, 3, 4];
  return [];
}

export function allocateMealCalories(total: number, mealCount: number) {
  const weights: Record<number, number[]> = {
    3: [0.25, 0.35, 0.4],
    4: [0.2, 0.3, 0.12, 0.38],
    5: [0.2, 0.1, 0.28, 0.12, 0.3],
  };
  const selectedWeights = weights[mealCount] ?? [];
  const allocated = selectedWeights.map((weight) => Math.round(total * weight));
  if (allocated.length > 0) {
    allocated[allocated.length - 1] += total - allocated.reduce((sum, value) => sum + value, 0);
  }
  return allocated;
}

export function matchesRecipe(recipe: SearchableRecipe, rawSearch: string, filter: string) {
  const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/yoghurt|dahi/g, "yogurt");
  const search = normalize(rawSearch.trim());
  const searchableText = normalize([recipe.name, recipe.description, ...recipe.tags, ...recipe.ingredients].join(" "));
  const matchesSearch = search.length === 0 || searchableText.includes(search);
  const matchesFilter = filter === "All"
    || (filter === "30 min or less" && Number.isFinite(recipe.totalMinutes) && recipe.totalMinutes > 0 && recipe.totalMinutes <= 30)
    || (filter === "Vegetarian" && recipe.tags.includes("Vegan"))
    || recipe.tags.some((tag) => tag.toLowerCase() === filter.toLowerCase());
  return matchesSearch && matchesFilter;
}

export function getEnergyRunway(calories: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) throw new RangeError("Calorie target must be a positive number");
  if (!Number.isFinite(calories) || calories < 0) throw new RangeError("Calories must be a finite non-negative number");
  const difference = target - calories;
  return {
    // Rounded here so every caller shows a whole number of calories. "1,943.2 kcal
    // remaining" reads like false precision on a figure that is an estimate anyway.
    amount: Math.round(Math.abs(difference)),
    isOver: difference < 0,
    percentage: Math.round((calories / target) * 100),
  };
}

type ScalableNutrition = {
  amount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export function scaleNutrition<T extends ScalableNutrition & { basis?: ScalableNutrition }>(food: T, requestedAmount: number): T {
  const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : 0;
  const basis = food.basis ?? { amount: food.amount, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber };
  const empty = () => ({ ...food, basis, amount: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  if (!Number.isFinite(basis.amount) || basis.amount <= 0 || !Number.isFinite(amount) || amount <= 0) return empty() as T;
  const scale = amount / basis.amount;
  if (!Number.isFinite(scale) || scale <= 0) return empty() as T;
  const scaled = (value: number) => Math.round(value * scale * 100) / 100;
  const result = {
    ...food,
    basis,
    amount,
    calories: scaled(basis.calories),
    protein: scaled(basis.protein),
    carbs: scaled(basis.carbs),
    fat: scaled(basis.fat),
    fiber: scaled(basis.fiber),
  };
  return [result.amount, result.calories, result.protein, result.carbs, result.fat, result.fiber].every(Number.isFinite) ? result : empty() as T;
}

export function getQuantityLimit(unit: string) {
  if (unit === "g" || unit === "ml") return 5000;
  if (unit === "scoop") return 10;
  if (unit === "pack" || unit === "serving") return 20;
  if (unit === "piece") return 50;
  return 0;
}

export function isQuantityValid(unit: string, amount: number) {
  const limit = getQuantityLimit(unit);
  return limit > 0 && Number.isFinite(amount) && amount > 0 && amount <= limit;
}

type MacroNutrition = Pick<ScalableNutrition, "calories" | "protein" | "carbs" | "fat">;

export function getNutritionDelta(next: MacroNutrition, previous: MacroNutrition | null) {
  const difference = (value: number, oldValue: number) => Math.round((value - oldValue) * 100) / 100;
  return {
    calories: difference(next.calories, previous?.calories ?? 0),
    protein: difference(next.protein, previous?.protein ?? 0),
    carbs: difference(next.carbs, previous?.carbs ?? 0),
    fat: difference(next.fat, previous?.fat ?? 0),
  };
}

export type SatietyInput = {
  calories: number;
  protein: number;
  fiber: number;
  /** Serving size and unit. Energy density is only used when the serving is a real mass or volume. */
  amount?: number;
  unit?: string;
};

const SATIETY_PROTEIN_WEIGHT = 45;
const SATIETY_FIBRE_WEIGHT = 25;
const SATIETY_DENSITY_WEIGHT = 30;
/** Roughly the highest protein and fibre densities any real food reaches, used to cap each term. */
const PROTEIN_PER_100KCAL_CEILING = 12;
const FIBRE_PER_100KCAL_CEILING = 5;
/** Energy density in kcal/100 g: at or below this scores full marks, at or above the ceiling scores nothing. */
const ENERGY_DENSITY_FLOOR = 40;
const ENERGY_DENSITY_CEILING = 300;

/**
 * A 0–100 estimate of how filling a food is per calorie.
 *
 * This is an estimate, never a measurement, and is labelled as one wherever it is shown.
 * It is computed rather than hand-assigned so it can never drift away from the macros it
 * claims to describe, and so a corrected macro immediately corrects the score.
 *
 * The three drivers are protein density, fibre density, and low energy density — the
 * factors that consistently separate filling foods from easily-overeaten ones. Energy
 * density needs a mass or volume serving; for a scoop, pack, piece or serving it is
 * dropped and the remaining weights are rescaled rather than assumed.
 */
export function estimateSatiety(food: SatietyInput): number {
  if (!Number.isFinite(food.calories) || food.calories <= 0) return 0;
  const protein = Number.isFinite(food.protein) ? Math.max(0, food.protein) : 0;
  const fiber = Number.isFinite(food.fiber) ? Math.max(0, food.fiber) : 0;

  const proteinPer100kcal = (protein / food.calories) * 100;
  const fibrePer100kcal = (fiber / food.calories) * 100;
  const proteinTerm = SATIETY_PROTEIN_WEIGHT * Math.min(1, proteinPer100kcal / PROTEIN_PER_100KCAL_CEILING);
  const fibreTerm = SATIETY_FIBRE_WEIGHT * Math.min(1, fibrePer100kcal / FIBRE_PER_100KCAL_CEILING);

  const massBased = (food.unit === "g" || food.unit === "ml") && Number.isFinite(food.amount) && (food.amount ?? 0) > 0;
  if (!massBased) {
    // Rescale the two available terms to the full 0–100 range instead of pretending the
    // missing energy-density term scored zero.
    const available = SATIETY_PROTEIN_WEIGHT + SATIETY_FIBRE_WEIGHT;
    return Math.round(((proteinTerm + fibreTerm) / available) * 100);
  }

  const energyDensity = (food.calories / (food.amount as number)) * 100;
  const densityFraction = Math.min(1, Math.max(0, (ENERGY_DENSITY_CEILING - energyDensity) / (ENERGY_DENSITY_CEILING - ENERGY_DENSITY_FLOOR)));
  return Math.round(proteinTerm + fibreTerm + SATIETY_DENSITY_WEIGHT * densityFraction);
}

export function satietyLabel(score: number) {
  if (score >= 70) return "Very filling";
  if (score >= 50) return "Filling";
  if (score >= 30) return "Moderate";
  return "Easy to overeat";
}

export type NutritionTarget = {
  maxCalories?: number;
  minProtein?: number;
  maxProtein?: number;
  minFiber?: number;
};

/** True when every supplied bound is satisfied. Blank or invalid bounds are ignored. */
export function matchesNutritionTarget(entry: { calories: number; protein: number; fiber: number }, target: NutritionTarget) {
  const within = (value: number, bound: number | undefined, compare: (a: number, b: number) => boolean) =>
    bound === undefined || !Number.isFinite(bound) ? true : compare(value, bound);
  return within(entry.calories, target.maxCalories, (a, b) => a <= b)
    && within(entry.protein, target.minProtein, (a, b) => a >= b)
    && within(entry.protein, target.maxProtein, (a, b) => a <= b)
    && within(entry.fiber, target.minFiber, (a, b) => a >= b);
}

export function hasNutritionTarget(target: NutritionTarget) {
  return [target.maxCalories, target.minProtein, target.maxProtein, target.minFiber].some((value) => value !== undefined && Number.isFinite(value));
}

export function sumLoggedNutrition(entries: MacroNutrition[], base: MacroNutrition) {
  const totals = entries.reduce((sum, food) => ({
    calories: sum.calories + food.calories,
    protein: sum.protein + food.protein,
    carbs: sum.carbs + food.carbs,
    fat: sum.fat + food.fat,
  }), { ...base });
  const rounded = (value: number) => Math.round(value * 100) / 100;
  return {
    calories: rounded(totals.calories),
    protein: rounded(totals.protein),
    carbs: rounded(totals.carbs),
    fat: rounded(totals.fat),
  };
}
