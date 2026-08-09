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
    amount: Math.abs(difference),
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
