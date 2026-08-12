import type { NutritionItem } from "./nutrition-data";

export type FoodIconKey =
  | "dairy"
  | "egg"
  | "meat"
  | "fish"
  | "grain"
  | "legume"
  | "vegetable"
  | "fruit"
  | "nut"
  | "supplement"
  | "sweet"
  | "oil"
  | "beverage"
  | "meal"
  | "generic";

/**
 * Keyword groups are checked in order, so the more specific food wins: "coconut
 * oil" must read as oil, not nut, and "chicken curry" as meat, not meal.
 */
const iconRules: Array<[FoodIconKey, string[]]> = [
  // Compound words that would otherwise be stolen by a broader rule below.
  ["dairy", ["buttermilk", "butter milk"]],
  ["meat", ["butter chicken"]],
  ["nut", ["peanut butter"]],
  ["oil", ["oil", "ghee", "butter", "olive"]],
  ["supplement", ["whey", "protein powder", "isolate", "casein", "creatine", "scoop", "supplement", "bcaa"]],
  ["sweet", ["chocolate", "cocoa", "brownie", "jaggery", "sugar", "honey", "dessert", "cake", "biscuit", "cookie"]],
  ["egg", ["egg", "anda", "omelette"]],
  ["fish", ["fish", "salmon", "tuna", "prawn", "shrimp", "surmai", "rohu"]],
  ["meat", ["chicken", "mutton", "lamb", "keema", "meat", "turkey", "beef", "pork", "tandoori"]],
  ["dairy", ["milk", "curd", "dahi", "yogurt", "yoghurt", "paneer", "cheese", "cream", "lassi", "buttermilk"]],
  ["legume", ["dal", "daal", "lentil", "rajma", "chana", "chickpea", "bean", "moong", "toor", "urad", "peas", "tofu", "soya", "soy"]],
  ["nut", ["almond", "cashew", "walnut", "peanut", "pista", "nut", "seed", "chia", "flax", "til", "sesame"]],
  ["grain", ["rice", "roti", "chapati", "wheat", "atta", "oats", "quinoa", "poha", "bread", "pasta", "millet", "ragi", "upma", "idli", "dosa", "uttapam"]],
  ["fruit", ["banana", "apple", "mango", "orange", "berry", "grape", "papaya", "guava", "fruit", "lemon", "pineapple", "watermelon"]],
  ["vegetable", ["spinach", "palak", "tomato", "onion", "potato", "carrot", "cauliflower", "gobi", "broccoli", "cabbage", "bhindi", "brinjal", "eggplant", "cucumber", "vegetable", "veg", "salad", "methi"]],
  ["beverage", ["juice", "coffee", "tea", "chai", "smoothie", "shake", "water", "soda", "drink"]],
];

/**
 * Picks the drawn fallback for a food. Pure and keyword-based so it works
 * offline and can be unit-tested without rendering anything.
 */
export function foodIconKey(food: Pick<NutritionItem, "name" | "brand" | "category"> & { aliases?: string[] }): FoodIconKey {
  // Whole-word matching only. A plain substring search reads "boiled" as oil,
  // "until" as nut and "eggplant" as egg, which puts nonsense icons in the list.
  const words = ` ${[food.name, food.brand, ...(food.aliases ?? [])].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const hasWord = (keyword: string) => words.includes(` ${keyword} `) || words.includes(` ${keyword}s `);
  for (const [key, keywords] of iconRules) {
    if (keywords.some(hasWord)) return key;
  }
  if (food.category === "Meal") return "meal";
  return "generic";
}

const paths: Record<FoodIconKey, React.ReactNode> = {
  dairy: <><path d="M9 2h6v3l2 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-3V2Z" /><path d="M7 12h10" opacity="0.45" /></>,
  egg: <ellipse cx="12" cy="13" rx="6" ry="8" />,
  meat: <><path d="M14 4a5 5 0 0 1 4 8l-6 6-3-3 6-6a2 2 0 0 0-1-5Z" /><circle cx="7" cy="18" r="3" /></>,
  fish: <><path d="M3 12s4-5 9-5 9 5 9 5-4 5-9 5-9-5-9-5Z" /><circle cx="16" cy="12" r="1.3" fill="currentColor" /></>,
  grain: <><path d="M12 3v18" /><path d="M12 7c3 0 4-2 4-2s-1 4-4 4Zm0 0c-3 0-4-2-4-2s1 4 4 4Z" /><path d="M12 14c3 0 4-2 4-2s-1 4-4 4Zm0 0c-3 0-4-2-4-2s1 4 4 4Z" /></>,
  legume: <><circle cx="8" cy="9" r="3.2" /><circle cx="15" cy="12" r="3.2" /><circle cx="10" cy="16" r="3.2" /></>,
  vegetable: <><path d="M20 4C11 4 4 9 4 17c0 2 1 3 3 3 8 0 13-7 13-16Z" /><path d="M7 19c3-5 7-8 11-10" opacity="0.5" /></>,
  fruit: <><path d="M12 7c-4 0-6 3-6 7s3 7 6 7 6-3 6-7-2-7-6-7Z" /><path d="M12 7V3" /><path d="M12 5c2 0 3-1 4-2" /></>,
  nut: <><ellipse cx="12" cy="12" rx="5" ry="8" /><path d="M12 5v14" opacity="0.45" /></>,
  supplement: <><rect x="5" y="8" width="14" height="12" rx="2" /><path d="M9 8V5h6v3" /><path d="M9 14h6" opacity="0.5" /></>,
  sweet: <><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M9 6v12M15 6v12M4 12h16" opacity="0.45" /></>,
  oil: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />,
  beverage: <><path d="M6 8h11v7a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V8Z" /><path d="M17 10h2a2 2 0 0 1 0 4h-2" /><path d="M9 3v3M13 3v3" opacity="0.5" /></>,
  meal: <><path d="M3 12h18" /><path d="M5 12a7 7 0 0 1 14 0" /><path d="M4 17h16" opacity="0.5" /></>,
  generic: <><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M3 19h18" opacity="0.5" /></>,
};

export function FoodIcon({ name }: { name: FoodIconKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
