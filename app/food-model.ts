// One food model for the whole app.
//
// Nourish used to carry two parallel shapes: NutritionItem (products and raw
// ingredients) and Meal (calculated recipes), bridged by a lossy copy that
// only Track could log. Anything added in one place was invisible in the
// other. There is now exactly one Food record, discriminated by `kind`:
//
//   product — one nutrition label. Its macros are the label, stored directly.
//   recipe  — a combination of two or more products. Its macros are NEVER
//             stored; they are calculated from `components` every read, so
//             correcting a component product updates every recipe using it.
//
// A ready-to-eat product with a single nutrition label stays a `product`
// (that is where its numbers come from) and sets `preparedMeal`, which makes
// it list under Meals as well as Items. Fungible across the board.

export type FoodUnit = "g" | "ml" | "scoop" | "pack" | "piece" | "serving";
export type FoodKind = "product" | "recipe";
export type FoodCategory = "Ordered" | "Product" | "Ingredient" | "Meal";
export type SourceTrust = "Official label" | "Reference" | "Label mirror" | "Personal";

// Single source of truth for serving bounds. Previously duplicated in
// prototype-logic.ts and local-nutrition-state.ts, where they could drift.
export const UNIT_LIMITS: Record<FoodUnit, number> = { g: 5000, ml: 5000, scoop: 10, pack: 20, piece: 50, serving: 20 };
export const FOOD_UNITS = Object.keys(UNIT_LIMITS) as FoodUnit[];
export const FOOD_CATEGORIES: FoodCategory[] = ["Ordered", "Product", "Ingredient", "Meal"];
export const SOURCE_TRUSTS: SourceTrust[] = ["Official label", "Reference", "Label mirror", "Personal"];

/** A recipe is a *combination*; one component is just a product in disguise. */
export const MIN_RECIPE_COMPONENTS = 2;
export const MAX_RECIPE_COMPONENTS = 40;

export type NutritionSource = {
  label: string;
  url: string;
  trust: SourceTrust;
};

/**
 * Catalogue thumbnails are committed to the repo under public/food-images/ and
 * referenced as "/food-images/<id>.webp". Foods created in the browser can
 * only reference a remote URL — a web page cannot write into the repository.
 */
export type FoodImage = {
  url: string;
  kind: "pack" | "label" | "dish";
  credit?: string;
};

export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type FoodComponent = {
  foodId: string;
  /** Amount of that component in ONE serving of this recipe, in the component's own unit. */
  amount: number;
};

export type Food = NutritionFacts & {
  id: string;
  kind: FoodKind;
  brand: string;
  name: string;
  variant: string;
  /** Serving basis the macros above describe. */
  amount: number;
  unit: FoodUnit;
  category: FoodCategory;
  availability: string;
  common?: boolean;
  aliases: string[];
  source: NutritionSource;
  images?: FoodImage[];
  /** Present on a scaled copy: the original per-basis numbers, so re-editing never compounds. */
  basis?: NutritionFacts & { amount: number };

  // Product attributes
  packSize?: string;
  barcode?: string;
  sugar?: number;
  sodium?: number;
  /** Ready-to-eat single-label product: acts as a product, lists under Meals too. */
  preparedMeal?: boolean;

  // Recipe attributes
  components?: FoodComponent[];
  /** Human serving description, e.g. "1 large bowl". */
  serving?: string;
  tags?: string[];
  time?: string;
  totalMinutes?: number;
  art?: string;
  description?: string;
  /** Display-only ingredient lines. `components` remains the calculation truth. */
  ingredients?: string[];
  method?: string[];
  sourceNote?: string;
};

export const ZERO_NUTRITION: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const roundMacro = (value: number) => Math.round(value * 10) / 10;

export function isFoodUnit(value: unknown): value is FoodUnit {
  return typeof value === "string" && value in UNIT_LIMITS;
}

export function getQuantityLimit(unit: string) {
  return isFoodUnit(unit) ? UNIT_LIMITS[unit] : 0;
}

export function isQuantityValid(unit: string, amount: number) {
  const limit = getQuantityLimit(unit);
  return limit > 0 && Number.isFinite(amount) && amount > 0 && amount <= limit;
}

export function isRecipe(food: Pick<Food, "kind">): boolean {
  return food.kind === "recipe";
}

/** Lists under Plan · Items: everything with its own label, prepared meals included. */
export function listsAsProduct(food: Pick<Food, "kind">): boolean {
  return food.kind === "product";
}

/** Lists under Plan · Meals: calculated recipes plus ready-to-eat single-label products. */
export function listsAsMeal(food: Pick<Food, "kind" | "preparedMeal">): boolean {
  return food.kind === "recipe" || food.preparedMeal === true;
}

export function foodLabel(food: Pick<Food, "brand" | "name" | "variant">) {
  return [food.brand, food.name, food.variant].map((part) => (part ?? "").trim()).filter(Boolean).join(" · ");
}

export function primaryImage(food: Pick<Food, "images">): FoodImage | null {
  return food.images?.find((image) => typeof image.url === "string" && image.url.trim().length > 0) ?? null;
}

/**
 * Recipe macros are derived, never stored, so a component correction reaches
 * every recipe that uses it. `seen` breaks cycles if a recipe ever references
 * itself through another recipe.
 */
export function computeNutrition(food: Food, catalog: Food[], seen: ReadonlySet<string> = new Set()): NutritionFacts {
  if (food.kind !== "recipe") {
    return { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber };
  }
  const components = food.components ?? [];
  if (components.length === 0 || seen.has(food.id)) return { ...ZERO_NUTRITION };
  const nextSeen = new Set(seen).add(food.id);
  const totals = components.reduce((sum, component) => {
    const part = catalog.find((candidate) => candidate.id === component.foodId);
    if (!part || !Number.isFinite(component.amount) || component.amount <= 0 || !(part.amount > 0)) return sum;
    const facts = computeNutrition(part, catalog, nextSeen);
    const scale = component.amount / part.amount;
    if (!Number.isFinite(scale) || scale <= 0) return sum;
    return {
      calories: sum.calories + facts.calories * scale,
      protein: sum.protein + facts.protein * scale,
      carbs: sum.carbs + facts.carbs * scale,
      fat: sum.fat + facts.fat * scale,
      fiber: sum.fiber + facts.fiber * scale,
    };
  }, { ...ZERO_NUTRITION });
  return {
    calories: Math.round(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
    fiber: roundMacro(totals.fiber),
  };
}

/** A recipe carrying its currently-calculated macros, ready to display or scale. */
export function resolveFood(food: Food, catalog: Food[]): Food {
  return food.kind === "recipe" ? { ...food, ...computeNutrition(food, catalog) } : food;
}

export function resolveCatalog(catalog: Food[]): Food[] {
  return catalog.map((food) => resolveFood(food, catalog));
}

/** Components whose product is missing from the catalogue — surfaced, never silently dropped (EDGE-03). */
export function missingComponents(food: Food, catalog: Food[]): FoodComponent[] {
  if (food.kind !== "recipe") return [];
  return (food.components ?? []).filter((component) => !catalog.some((candidate) => candidate.id === component.foodId));
}

export type FoodValidation = { valid: boolean; problems: string[] };

export function validateFood(food: Food, catalog: Food[] = []): FoodValidation {
  const problems: string[] = [];
  if (!food.brand?.trim()) problems.push("Brand is required. Use “Generic” for unbranded food.");
  if (!food.name?.trim()) problems.push("Item name is required.");
  if (!isFoodUnit(food.unit)) problems.push("Choose a serving unit.");
  if (!isQuantityValid(food.unit, food.amount)) problems.push(`Serving basis must be between 0 and ${getQuantityLimit(food.unit) || "the unit limit"} ${food.unit}.`);

  if (food.kind === "recipe") {
    const components = food.components ?? [];
    if (components.length < MIN_RECIPE_COMPONENTS) problems.push(`A meal is a combination — add at least ${MIN_RECIPE_COMPONENTS} products.`);
    if (components.length > MAX_RECIPE_COMPONENTS) problems.push(`A meal cannot hold more than ${MAX_RECIPE_COMPONENTS} products.`);
    if (components.some((component) => !Number.isFinite(component.amount) || component.amount <= 0)) problems.push("Every product in the meal needs an amount above zero.");
    if (new Set(components.map((component) => component.foodId)).size !== components.length) problems.push("The same product is listed twice — combine it into one line.");
    if (catalog.length > 0) {
      const missing = missingComponents(food, catalog);
      if (missing.length > 0) problems.push(`Missing from your catalogue: ${missing.map((component) => component.foodId).join(", ")}.`);
    }
  } else {
    if (food.components && food.components.length > 0) problems.push("A product has one nutrition label, not a component list.");
    const macros = [food.calories, food.protein, food.carbs, food.fat, food.fiber];
    if (macros.some((value) => !Number.isFinite(value) || value < 0)) problems.push("Calories and macros must be zero or more.");
  }
  return { valid: problems.length === 0, problems };
}

/** Stable, collision-resistant id for a food KP creates (ARCH-06: unique under worst case, not typical case). */
export function makeFoodId(kind: FoodKind, brand: string, name: string, existingIds: Iterable<string> = []) {
  const slug = `${brand} ${name}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "food";
  const base = `${kind === "recipe" ? "meal" : "my"}-${slug}`;
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Overrides win by id; anything new is appended. Used to layer KP's foods over the seed catalogue. */
export function mergeCatalog(base: Food[], overrides: Food[]): Food[] {
  const byId = new Map(overrides.map((food) => [food.id, food]));
  const baseIds = new Set(base.map((food) => food.id));
  return [...base.map((food) => byId.get(food.id) ?? food), ...overrides.filter((food) => !baseIds.has(food.id))];
}

export function searchFoods(catalog: Food[], rawQuery: string): Food[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return catalog;
  return catalog.filter((food) => [food.brand, food.name, food.variant, food.packSize ?? "", ...(food.aliases ?? []), ...(food.tags ?? [])]
    .join(" ").toLowerCase().includes(query));
}
