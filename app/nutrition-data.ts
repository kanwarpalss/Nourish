export type NutritionSource = {
  label: string;
  url: string;
  // "Estimated" marks a log entry KP corrected or renamed by hand at log time — the fourth
  // provenance tier named in .claude/CLAUDE.md invariant 3. It is set only on a resolved log
  // entry (day-history.ts), never on a catalogue food, so the researched value for future
  // logs of the same food is never silently overwritten by one day's correction.
  trust: "Official label" | "Reference" | "Label mirror" | "Estimated" | "Personal";
};

export type NutritionUnit = "g" | "ml" | "scoop" | "pack" | "piece" | "serving";

export type NutritionConversion = {
  unit: NutritionUnit;
  /** How much of the nutrition-basis unit one of this unit contains. */
  basisAmount: number;
  label?: string;
};

export type NutritionItem = {
  id: string;
  name: string;
  brand: string;
  variant: string;
  amount: number;
  unit: NutritionUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: "Ordered" | "Product" | "Ingredient" | "Meal" | "Composite";
  availability: string;
  common?: boolean;
  aliases: string[];
  /** Hot-linked photo. Absent means the food falls back to a drawn icon. */
  imageUrl?: string;
  source: NutritionSource;
  conversions?: NutritionConversion[];
  basis?: { amount: number; unit?: NutritionUnit; calories: number; protein: number; carbs: number; fat: number; fiber: number };
  /** Present on composite dishes: the weighed parts this food was calculated from. */
  components?: Array<{ foodId: string; amount: number }>;
};

export type Meal = {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  time: string;
  totalMinutes: number;
  tags: string[];
  art: string;
  description: string;
  ingredients: string[];
  nutritionBasis: Array<{ foodId: string; amount: number }>;
  method: string[];
  sourceNote: string;
};

export const SOURCE_LINKS = {
  ifct: "https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf",
  // The versioned PDF filename rotted to a 404. This viewer page is the stable landing
  // page for the 2024 guidelines and does not carry a build date in its URL.
  ninGuidelines: "https://www.nin.res.in/dietaryguidelines/index.html",
  usda: "https://fdc.nal.usda.gov/",
  fssai: "https://www.fssai.gov.in/upload/uploadfiles/files/Guidelines_Nutrition_Labelling_16_08_2018.pdf",
};

const usdaSource: NutritionSource = { label: "USDA FoodData Central", url: SOURCE_LINKS.usda, trust: "Reference" };
const ifctSource: NutritionSource = { label: "ICMR–NIN Indian Food Composition Tables 2017", url: SOURCE_LINKS.ifct, trust: "Reference" };

/**
 * Indian dairy grades are legally defined by fat and solids-not-fat minimums, so a
 * category reference is genuinely accurate for any brand's toned, double-toned, skimmed,
 * or full-cream milk. It is still weaker than the pack in front of KP, so it is labelled
 * Reference rather than Official label.
 */
const fssaiGradeSource: NutritionSource = { label: "FSSAI milk-grade standard · confirm your pack", url: SOURCE_LINKS.fssai, trust: "Reference" };

/**
 * Values transcribed from a published nutrition panel found online rather than from the
 * pack in KP's hand. Open Food Facts entries carry a barcode and a photograph of the
 * actual label, which is the strongest of these; brand and aggregator pages are weaker.
 *
 * Every one of these was cross-checked against its own macros before being accepted: if
 * protein x4 + available carbs x4 + fat x9 + fibre x2 disagreed with the stated energy by
 * more than about 6%, the value was rejected rather than entered. See
 * data/NUTRITION_SOURCES.md for what was rejected and why.
 */
const labelMirror = (label: string, url: string): NutritionSource => ({ label, url, trust: "Label mirror" });
/** A real published panel used as a category reference — a different brand's pack, not KP's own. */
const referencedPanel = (label: string, url: string): NutritionSource => ({ label, url, trust: "Reference" });

const nutritionSeedItems: Array<Omit<NutritionItem, "brand" | "variant"> & { brand?: string; variant?: string }> = [
  {
    id: "nandini-goodlife-toned",
    imageUrl: "https://www.bbassets.com/media/uploads/p/m/100285703_15-nandini-goodlife-toned-milk.jpg",
    name: "GoodLife UHT toned milk",
    brand: "Nandini",
    variant: "1 L carton",
    amount: 100,
    unit: "ml",
    calories: 60,
    protein: 3.3,
    carbs: 4.8,
    fat: 3.1,
    fiber: 0,
    category: "Ordered",
    availability: "BigBasket · Bengaluru",
    common: true,
    aliases: ["milk", "toned milk", "good life", "kmf"],
    conversions: [{ unit: "pack", basisAmount: 1000, label: "1 carton" }],
    source: { label: "Current retailer label · KMF product", url: "https://www.bigbasket.com/pd/100285703/nandini-goodlife-toned-milk-1-l-carton/", trust: "Label mirror" },
  },
  {
    id: "epigamia-natural-greek",
    imageUrl: "https://www.bbassets.com/media/uploads/p/m/40046546_6-epigamia-greek-yogurt-natural.jpg",
    name: "Natural Greek yogurt",
    brand: "Epigamia",
    amount: 90,
    unit: "g",
    calories: 64,
    protein: 7,
    carbs: 3,
    fat: 2,
    fiber: 0,
    category: "Ordered",
    availability: "Instamart-style quick commerce",
    common: true,
    aliases: ["greek yoghurt", "curd", "dahi", "epigamia"],
    source: { label: "Product-label mirror · recheck exact pack", url: "https://www.eatthismuch.com/calories/greek-yogurt-natural-1806163", trust: "Label mirror" },
  },
  {
    id: "muscleblaze-biozyme-whey",
    imageUrl: "https://www.bbassets.com/media/uploads/p/m/40230229_1-muscleblaze-biozyme-whey-protein-improves-protein-absorption-by-50-rich-milk-chocolate.jpg",
    name: "Biozyme Whey · Rich Milk Chocolate",
    brand: "MuscleBlaze",
    amount: 1,
    unit: "scoop",
    calories: 131.68,
    protein: 25,
    carbs: 3.87,
    fat: 1.76,
    fiber: 0,
    category: "Ordered",
    availability: "Amazon India / brand store",
    common: true,
    aliases: ["whey", "protein powder", "biozyme", "shake"],
    source: { label: "MuscleBlaze official · 33 g scoop", url: "https://biozyme.muscleblaze.com/what-is-biozyme-whey.php", trust: "Official label" },
  },
  {
    id: "amul-high-protein-buttermilk",
    name: "High Protein Buttermilk",
    brand: "Amul",
    amount: 1,
    unit: "pack",
    calories: 108,
    protein: 15,
    carbs: 8,
    fat: 1,
    fiber: 0,
    category: "Product",
    availability: "Amul online · India",
    common: true,
    aliases: ["chaas", "buttermilk", "protein drink"],
    source: { label: "Amul official · 200 ml pack", url: "https://old.amul.com/products/amul-highprotein-buttermilk-info.php", trust: "Official label" },
  },
  {
    id: "amul-high-protein-paneer",
    name: "High Protein Paneer",
    brand: "Amul",
    amount: 100,
    unit: "g",
    calories: 170,
    protein: 25,
    carbs: 4,
    fat: 6,
    fiber: 0,
    category: "Product",
    availability: "Amul online · India",
    common: true,
    aliases: ["low fat paneer", "cottage cheese", "amul paneer"],
    source: { label: "Amul official", url: "https://old.amul.com/products/amul-HP-tin-paneer-info.php", trust: "Official label" },
  },
  { id: "banana", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Cavendish_banana_from_Maracaibo.jpg/330px-Cavendish_banana_from_Maracaibo.jpg", name: "Banana · medium", amount: 118, unit: "g", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, category: "Ingredient", availability: "Bengaluru staple", common: true, aliases: ["kela", "fruit"], conversions: [{ unit: "piece", basisAmount: 118, label: "1 medium banana" }], source: usdaSource },
  { id: "chia", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Chia_Seeds_with_the_word_Chia_spelled_out.jpg/330px-Chia_Seeds_with_the_word_Chia_spelled_out.jpg", name: "Chia seeds", amount: 25, unit: "g", calories: 122, protein: 4.1, carbs: 10.5, fat: 7.7, fiber: 8.6, category: "Ingredient", availability: "BigBasket · Bengaluru", common: true, aliases: ["seeds", "omega 3", "pudding"], source: usdaSource },
  { id: "oats", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Rolled_oats.jpg/330px-Rolled_oats.jpg", name: "Rolled oats · dry", amount: 40, unit: "g", calories: 152, protein: 5.3, carbs: 27.1, fat: 2.6, fiber: 4, category: "Ingredient", availability: "Widely available in India", aliases: ["oatmeal", "porridge"], source: usdaSource },
  { id: "cauliflower", name: "Cauliflower · raw", amount: 250, unit: "g", calories: 63, protein: 4.8, carbs: 12.4, fat: 0.7, fiber: 5, category: "Ingredient", availability: "Bengaluru produce", aliases: ["gobi", "cauliflower rice", "vegetable"], source: usdaSource },
  { id: "chicken-breast", name: "Chicken breast · cooked", amount: 150, unit: "g", calories: 248, protein: 46.5, carbs: 0, fat: 5.4, fiber: 0, category: "Ingredient", availability: "Bengaluru poultry / quick commerce", aliases: ["boneless chicken", "roasted chicken"], source: usdaSource },
  { id: "rajma-cooked", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Rajma_Red_Kidney_Bean_dish_India.jpg/330px-Rajma_Red_Kidney_Bean_dish_India.jpg", name: "Rajma · cooked", amount: 150, unit: "g", calories: 191, protein: 13, carbs: 34.2, fat: 0.8, fiber: 9.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["kidney beans", "beans"], source: usdaSource },
  { id: "quinoa-cooked", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Red_quinoa.png/330px-Red_quinoa.png", name: "Quinoa · cooked", amount: 150, unit: "g", calories: 180, protein: 6.6, carbs: 31.9, fat: 2.9, fiber: 4.2, category: "Ingredient", availability: "BigBasket / supermarkets", aliases: ["grain", "seed"], source: usdaSource },
  { id: "spinach", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Spinach_leaves.jpg/330px-Spinach_leaves.jpg", name: "Spinach · raw", amount: 100, unit: "g", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, category: "Ingredient", availability: "Bengaluru produce", aliases: ["palak", "greens"], source: usdaSource },
  { id: "egg-whites", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Bowl_of_egg_whites.jpg/330px-Bowl_of_egg_whites.jpg", name: "Egg whites", amount: 100, unit: "g", calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["eggs", "albumen"], conversions: [{ unit: "piece", basisAmount: 33, label: "1 large egg white" }], source: usdaSource },
  { id: "cocoa", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cocoa_powder.jpg/330px-Cocoa_powder.jpg", name: "Unsweetened cocoa powder", amount: 20, unit: "g", calories: 46, protein: 3.9, carbs: 11.6, fat: 2.7, fiber: 7.4, category: "Ingredient", availability: "Baking aisle / online India", aliases: ["cacao", "chocolate", "brownie"], source: usdaSource },
  { id: "chickpeas-cooked", name: "Chickpeas · cooked", amount: 100, unit: "g", calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["chana", "kabuli chana", "garbanzo"], source: usdaSource },
  { id: "green-peas-cooked", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/India_-_Varanasi_green_peas_-_2714.jpg/330px-India_-_Varanasi_green_peas_-_2714.jpg", name: "Green peas · cooked", amount: 100, unit: "g", calories: 84, protein: 5.4, carbs: 15.6, fat: 0.4, fiber: 5.5, category: "Ingredient", availability: "Bengaluru produce / frozen aisle", aliases: ["matar", "peas"], source: usdaSource },
  { id: "mango", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Mango_and_cross_sections.jpg/330px-Mango_and_cross_sections.jpg", name: "Mango · raw", amount: 150, unit: "g", calories: 90, protein: 1.2, carbs: 22.5, fat: 0.6, fiber: 2.4, category: "Ingredient", availability: "Seasonal Bengaluru produce", aliases: ["aam", "fruit"], source: usdaSource },
  { id: "strawberries", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Organic-strawberries_Canada.jpg/330px-Organic-strawberries_Canada.jpg", name: "Strawberries · raw", amount: 100, unit: "g", calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, category: "Ingredient", availability: "Seasonal / frozen Bengaluru", aliases: ["berries", "fruit"], source: usdaSource },
  { id: "pomegranate", name: "Pomegranate arils", amount: 100, unit: "g", calories: 83, protein: 1.7, carbs: 18.7, fat: 1.2, fiber: 4, category: "Ingredient", availability: "Bengaluru produce", aliases: ["anar", "fruit"], source: usdaSource },
  { id: "cucumber", name: "Cucumber · raw", amount: 100, unit: "g", calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, category: "Ingredient", availability: "Bengaluru produce", aliases: ["kheera", "salad", "kachumber"], source: usdaSource },
  { id: "tomato", name: "Tomato · raw", amount: 100, unit: "g", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, category: "Ingredient", availability: "Bengaluru produce", aliases: ["tamatar", "salad", "kachumber"], source: usdaSource },
  { id: "capsicum", name: "Green capsicum · raw", amount: 100, unit: "g", calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2, fiber: 1.7, category: "Ingredient", availability: "Bengaluru produce", aliases: ["bell pepper", "shimla mirch"], source: usdaSource },
  { id: "onion", name: "Onion · raw", amount: 100, unit: "g", calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, category: "Ingredient", availability: "Bengaluru produce", aliases: ["pyaaz", "salad", "kachumber"], source: usdaSource },
  { id: "carrot", name: "Carrot · raw", amount: 100, unit: "g", calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, category: "Ingredient", availability: "Bengaluru produce", aliases: ["gajar", "vegetable"], source: usdaSource },
  { id: "green-beans", name: "Green beans · raw", amount: 100, unit: "g", calories: 31, protein: 1.8, carbs: 7, fat: 0.2, fiber: 2.7, category: "Ingredient", availability: "Bengaluru produce", aliases: ["french beans", "beans", "vegetable"], source: usdaSource },
  { id: "bottle-gourd", name: "Bottle gourd · raw", amount: 100, unit: "g", calories: 14, protein: 0.6, carbs: 3.4, fat: 0.1, fiber: 0.5, category: "Ingredient", availability: "Bengaluru produce", aliases: ["lauki", "doodhi", "sorekaayi"], source: usdaSource },
  { id: "broccoli", name: "Broccoli · raw", amount: 100, unit: "g", calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, category: "Ingredient", availability: "Bengaluru produce / quick commerce", aliases: ["broccoli", "vegetable"], source: usdaSource },
  { id: "pumpkin", name: "Pumpkin · raw", amount: 100, unit: "g", calories: 26, protein: 1, carbs: 6.5, fat: 0.1, fiber: 0.5, category: "Ingredient", availability: "Bengaluru produce", aliases: ["kaddu", "squash"], source: usdaSource },
  // Counted in pieces, not grams: "how many calories in one egg" should not require KP to
  // know that a large egg is about 50 g of edible portion.
  { id: "whole-egg", name: "Whole egg · large", amount: 1, unit: "piece", calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0, category: "Ingredient", availability: "1 large egg · about 50 g edible", common: true, aliases: ["egg", "anda", "eggs", "boiled egg"], source: usdaSource },
  { id: "oil", name: "Cooking oil · reference", amount: 5, unit: "g", calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["measured oil", "fat"], conversions: [{ unit: "ml", basisAmount: 0.92, label: "1 ml" }], source: usdaSource },
  { id: "peanut-butter", name: "Peanut butter · smooth", amount: 32, unit: "g", calories: 188, protein: 8, carbs: 6, fat: 16, fiber: 1.9, category: "Ingredient", availability: "Widely available in India", aliases: ["groundnut butter", "spread"], source: usdaSource },
  { id: "almonds", name: "Almonds", amount: 28, unit: "g", calories: 164, protein: 6, carbs: 6.1, fat: 14.2, fiber: 3.5, category: "Ingredient", availability: "Bengaluru staple", aliases: ["badam", "nuts"], source: usdaSource },
  { id: "flax", name: "Flax seeds", amount: 20, unit: "g", calories: 107, protein: 3.7, carbs: 5.8, fat: 8.4, fiber: 5.5, category: "Ingredient", availability: "Online / supermarkets India", aliases: ["alsi", "seeds", "linseed"], source: usdaSource },
  { id: "sweet-potato", name: "Sweet potato · cooked", amount: 200, unit: "g", calories: 180, protein: 4, carbs: 41.4, fat: 0.3, fiber: 6.6, category: "Ingredient", availability: "Bengaluru produce", aliases: ["shakarkandi", "root vegetable"], source: usdaSource },
  { id: "brown-rice", name: "Brown rice · cooked", amount: 150, unit: "g", calories: 185, protein: 3.9, carbs: 38.4, fat: 1.6, fiber: 2.4, category: "Ingredient", availability: "Widely available in India", aliases: ["whole grain rice", "chawal"], source: usdaSource },
  { id: "greek-yogurt-nonfat", name: "Greek yogurt · non-fat reference", amount: 200, unit: "g", calories: 118, protein: 20.4, carbs: 7.2, fat: 0.8, fiber: 0, category: "Ingredient", availability: "Use exact local pack when available", aliases: ["strained yogurt", "hung curd", "dahi"], source: usdaSource },

  // --- Milk grades. KP's history contains 17 milk SKUs across Amul, Nandini, Sid's Farm,
  // Akshayakalpa, Country Delight and Milky Mist; all of them are one of these grades.
  { id: "milk-toned", name: "Toned milk · any brand", amount: 100, unit: "ml", calories: 59, protein: 3.2, carbs: 4.8, fat: 3.0, fiber: 0, category: "Ingredient", availability: "3.0% fat, 8.5% SNF minimum", common: true, aliases: ["milk", "doodh", "amul taaza", "nandini", "lactose free"], source: fssaiGradeSource },
  { id: "milk-double-toned", name: "Double toned milk · any brand", amount: 100, unit: "ml", calories: 47, protein: 3.4, carbs: 5.1, fat: 1.5, fiber: 0, category: "Ingredient", availability: "1.5% fat, 9.0% SNF minimum", aliases: ["milk", "doodh", "low fat milk"], source: fssaiGradeSource },
  { id: "milk-skimmed", name: "Skimmed milk · any brand", amount: 100, unit: "ml", calories: 36, protein: 3.5, carbs: 5.0, fat: 0.2, fiber: 0, category: "Ingredient", availability: "0.5% fat maximum", aliases: ["milk", "skim", "slim n trim", "fat free milk"], source: fssaiGradeSource },
  { id: "milk-full-cream", name: "Full cream milk · any brand", amount: 100, unit: "ml", calories: 88, protein: 3.4, carbs: 5.1, fat: 6.0, fiber: 0, category: "Ingredient", availability: "6.0% fat, 9.0% SNF minimum", aliases: ["milk", "doodh", "whole milk"], source: fssaiGradeSource },
  { id: "milk-cow-whole", name: "Whole cow milk · farm fresh", amount: 100, unit: "ml", calories: 73, protein: 3.3, carbs: 4.8, fat: 4.5, fiber: 0, category: "Ingredient", availability: "About 4.5% fat, unstandardised", aliases: ["milk", "cow milk", "sids farm", "akshayakalpa", "country delight"], source: ifctSource },

  // --- Curd, paneer, cheese
  { id: "curd-dahi", name: "Curd · dahi, set from toned milk", amount: 100, unit: "g", calories: 57, protein: 3.1, carbs: 4.5, fat: 3.0, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", common: true, aliases: ["dahi", "yogurt", "yoghurt", "nandini curd", "sids farm curd"], source: ifctSource },
  { id: "paneer-whole-milk", name: "Paneer · whole milk", amount: 100, unit: "g", calories: 296, protein: 18.9, carbs: 1.2, fat: 24.0, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["cottage cheese", "malai paneer", "heritage", "nandini paneer"], source: ifctSource },
  { id: "tofu", name: "Tofu · firm", amount: 100, unit: "g", calories: 83, protein: 8.1, carbs: 1.9, fat: 4.8, fiber: 0.3, category: "Ingredient", availability: "Quick commerce Bengaluru", aliases: ["soya paneer", "bean curd", "vegan paneer", "soyarich"], source: usdaSource },
  { id: "cheese-processed", name: "Processed cheese · block or cube", amount: 100, unit: "g", calories: 313, protein: 20.0, carbs: 2.0, fat: 25.0, fiber: 0, category: "Ingredient", availability: "Amul / D'lecta style", aliases: ["cheese", "cheddar", "cheese cube", "cheese block"], source: usdaSource },
  { id: "cheese-slice", name: "Cheese slice", amount: 1, unit: "piece", calories: 63, protein: 4.0, carbs: 0.4, fat: 5.0, fiber: 0, category: "Ingredient", availability: "About 20 g per slice", aliases: ["cheese", "laughing cow", "sandwich cheese"], source: usdaSource },
  { id: "dairy-cream", name: "Dairy cream · 25% fat", amount: 100, unit: "ml", calories: 247, protein: 2.1, carbs: 3.5, fat: 25.0, fiber: 0, category: "Ingredient", availability: "UHT cream, Bengaluru", aliases: ["cream", "malai", "dlecta", "milky mist cream"], source: usdaSource },

  // --- Grains and flours. Atta is the base for chapati.
  { id: "atta-whole-wheat", name: "Whole wheat atta · flour", amount: 100, unit: "g", calories: 321, protein: 12.1, carbs: 69.4, fat: 1.7, fiber: 11.4, category: "Ingredient", availability: "Chakki atta, Bengaluru staple", common: true, aliases: ["atta", "wheat flour", "gehu", "chapati flour", "roti flour"], source: ifctSource },
  { id: "rice-white-cooked", name: "White rice · cooked", amount: 150, unit: "g", calories: 195, protein: 4.0, carbs: 42.3, fat: 0.3, fiber: 0.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["chawal", "rice", "steamed rice"], source: usdaSource },
  { id: "poha-dry", name: "Poha · flattened rice, dry", amount: 100, unit: "g", calories: 346, protein: 6.6, carbs: 77.3, fat: 1.2, fiber: 2.5, category: "Ingredient", availability: "Bengaluru staple", aliases: ["poha", "avalakki", "flattened rice"], source: ifctSource },
  { id: "vermicelli-dry", name: "Vermicelli · roasted, dry", amount: 100, unit: "g", calories: 356, protein: 12.4, carbs: 71.5, fat: 1.5, fiber: 3.0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["semiya", "sevai", "vermicelli"], source: ifctSource },
  { id: "bread-whole-wheat", name: "Whole wheat bread · 1 slice", amount: 1, unit: "piece", calories: 74, protein: 3.6, carbs: 12.3, fat: 1.0, fiber: 2.0, category: "Ingredient", availability: "About 30 g per slice", aliases: ["bread", "brown bread", "atta bread", "zero maida"], source: usdaSource },
  { id: "bread-white", name: "White or sourdough bread · 1 slice", amount: 1, unit: "piece", calories: 80, protein: 2.9, carbs: 15.0, fat: 0.7, fiber: 0.8, category: "Ingredient", availability: "About 30 g per slice", aliases: ["bread", "sourdough", "sandwich bread", "pav"], source: usdaSource },

  // --- Pulses. Dry and cooked are kept separate because the difference is roughly 3x.
  { id: "moong-dal-dry", name: "Moong dal · dry", amount: 100, unit: "g", calories: 348, protein: 24.5, carbs: 59.0, fat: 1.2, fiber: 16.3, category: "Ingredient", availability: "Bengaluru staple", aliases: ["moong", "mung", "green gram", "dal"], source: ifctSource },
  { id: "moong-dal-cooked", name: "Moong dal · cooked", amount: 100, unit: "g", calories: 105, protein: 7.0, carbs: 19.1, fat: 0.4, fiber: 7.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["moong", "mung", "dal", "cooked dal"], source: ifctSource },
  { id: "toor-dal-cooked", name: "Toor dal · cooked", amount: 100, unit: "g", calories: 116, protein: 6.8, carbs: 20.6, fat: 0.4, fiber: 6.7, category: "Ingredient", availability: "Bengaluru staple", aliases: ["arhar", "tur", "dal", "sambar dal"], source: ifctSource },
  { id: "chana-dal-cooked", name: "Chana dal · cooked", amount: 100, unit: "g", calories: 121, protein: 6.8, carbs: 21.0, fat: 1.9, fiber: 5.8, category: "Ingredient", availability: "Bengaluru staple", aliases: ["chana", "bengal gram", "dal"], source: ifctSource },
  { id: "besan", name: "Besan · gram flour", amount: 100, unit: "g", calories: 387, protein: 22.4, carbs: 57.8, fat: 6.7, fiber: 10.8, category: "Ingredient", availability: "Bengaluru staple", aliases: ["besan", "gram flour", "chickpea flour"], source: ifctSource },
  { id: "chickpeas-dry", name: "Chickpeas · dry, uncooked", amount: 100, unit: "g", calories: 378, protein: 20.5, carbs: 62.9, fat: 6.0, fiber: 12.2, category: "Ingredient", availability: "Bengaluru staple", aliases: ["chana", "kabuli chana", "garbanzo", "chickpea"], source: usdaSource },
  { id: "sprouts-moong", name: "Moong sprouts · raw", amount: 100, unit: "g", calories: 30, protein: 3.0, carbs: 5.9, fat: 0.2, fiber: 1.8, category: "Ingredient", availability: "Bengaluru quick commerce", aliases: ["sprouts", "mixed sprouts", "moong sprouts"], source: usdaSource },

  // --- Produce and snacks appearing in KP's orders
  { id: "potato", name: "Potato · raw", amount: 100, unit: "g", calories: 77, protein: 2.0, carbs: 17.5, fat: 0.1, fiber: 2.2, category: "Ingredient", availability: "Bengaluru produce", aliases: ["aloo", "aloo gadde", "potato"], source: usdaSource },
  { id: "beetroot", name: "Beetroot · raw", amount: 100, unit: "g", calories: 43, protein: 1.6, carbs: 9.6, fat: 0.2, fiber: 2.8, category: "Ingredient", availability: "Bengaluru produce", aliases: ["chukandar", "beet"], source: usdaSource },
  { id: "brinjal", name: "Brinjal · raw", amount: 100, unit: "g", calories: 25, protein: 1.0, carbs: 5.9, fat: 0.2, fiber: 3.0, category: "Ingredient", availability: "Bengaluru produce", aliases: ["baingan", "eggplant", "badanekaayi", "aubergine"], source: usdaSource },
  { id: "lettuce", name: "Lettuce · raw", amount: 100, unit: "g", calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, category: "Ingredient", availability: "Bengaluru quick commerce", aliases: ["lettuce", "romaine", "salad leaves"], source: usdaSource },
  { id: "avocado", name: "Avocado · raw", amount: 100, unit: "g", calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, category: "Ingredient", availability: "Bengaluru quick commerce", aliases: ["avocado", "butter fruit", "hass"], source: usdaSource },
  { id: "guava", name: "Guava · raw", amount: 100, unit: "g", calories: 68, protein: 2.6, carbs: 14.3, fat: 1.0, fiber: 5.4, category: "Ingredient", availability: "Bengaluru produce", aliases: ["amrood", "seebe hannu", "guava"], source: usdaSource },
  { id: "makhana", name: "Makhana · fox nuts", amount: 30, unit: "g", calories: 104, protein: 2.9, carbs: 23.1, fat: 0.1, fiber: 4.5, category: "Ingredient", availability: "Bengaluru quick commerce", aliases: ["makhana", "phool makhana", "fox nuts", "lotus seeds"], source: ifctSource },
  { id: "peanuts-raw", name: "Peanuts · raw", amount: 30, unit: "g", calories: 170, protein: 7.7, carbs: 4.8, fat: 14.7, fiber: 2.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["moongphali", "groundnut", "peanut"], source: usdaSource },
  { id: "chicken-curry-cut-raw", name: "Chicken · raw, curry cut skinless", amount: 100, unit: "g", calories: 143, protein: 20.5, carbs: 0, fat: 6.6, fiber: 0, category: "Ingredient", availability: "Bengaluru poultry", aliases: ["chicken", "murgh", "curry cut", "sabzi chicken"], source: usdaSource },

  // --- Branded products KP repeatedly buys, transcribed from published nutrition panels.
  { id: "milkymist-greek-yogurt", name: "Greek yogurt · plain", brand: "Milky Mist", amount: 100, unit: "g", calories: 77, protein: 8, carbs: 6.5, fat: 2.2, fiber: 0, category: "Ordered", availability: "Instamart / Amazon · 100 g and 700 g packs", common: true, aliases: ["greek yogurt", "greek yoghurt", "milky mist", "milkymist", "curd", "dahi"], source: labelMirror("Open Food Facts · label photo, barcode 8904083302292", "https://world.openfoodfacts.org/product/8904083302292/greek-yogurt-milky-mist") },
  { id: "health-factory-protein-bread", name: "Zero Maida Protein Bread", brand: "The Health Factory", amount: 100, unit: "g", calories: 242, protein: 15.24, carbs: 41.5, fat: 1.68, fiber: 4.88, category: "Ordered", availability: "Amazon · 250 g loaf", aliases: ["protein bread", "zero maida", "health factory", "bread"], source: labelMirror("Open Food Facts · label photo, barcode 8908009059246", "https://world.openfoodfacts.org/product/8908009059246/zero-maida-protein-bread-the-health-factory") },
  { id: "epigamia-turbo-shake", name: "Turbo 25 g protein milkshake", brand: "Epigamia", amount: 1, unit: "pack", calories: 141, protein: 25, carbs: 9, fat: 0.2, fiber: 0, category: "Ordered", availability: "Amazon · 250 ml bottle", aliases: ["epigamia turbo", "protein shake", "milkshake", "protein drink"], source: labelMirror("Published panel · 250 ml bottle, cookies and cream", "https://www.fatsecret.co.in/calories-nutrition/epigamia/epigamia-turbo-protein-milkshake-chocolate/1-serving") },
  { id: "cosmix-plant-protein", name: "No-Nonsense Plant Protein", brand: "Cosmix", amount: 1, unit: "scoop", calories: 145, protein: 23.5, carbs: 11.7, fat: 0.2, fiber: 0, category: "Ordered", availability: "Amazon · 38 g scoop · panel is for the unflavoured variant", aliases: ["cosmix", "plant protein", "vegan protein", "pea protein"], source: labelMirror("Published panel · 38 g scoop, classic unflavoured", "https://www.fatsecret.co.in/calories-nutrition/cosmix/no-nonsense-plant-protein/1-serving") },
  { id: "so-good-oat-unsweetened", name: "Oat beverage · unsweetened", brand: "So Good", amount: 100, unit: "ml", calories: 59, protein: 1, carbs: 6.9, fat: 3, fiber: 0, category: "Ordered", availability: "Amazon · 200 ml and 1 L · unsweetened variant only", aliases: ["oat milk", "oat beverage", "so good", "plant milk", "dairy free milk"], source: labelMirror("Published panel · unsweetened variant", "https://www.amazon.in/So-Good-Unsweetened-Preservatives-Cholesterol/dp/B0BR3RPBS5") },
  { id: "cola-zero-sugar", name: "Zero-sugar cola · any brand", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Product", availability: "Coke Zero, Diet Coke, Pepsi Zero, Sprite Zero", aliases: ["coke zero", "diet coke", "pepsi zero", "sprite zero", "cola", "soft drink", "soda"], source: { label: "Coca-Cola India · Zero Sugar product page", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-coca-cola-zero-sugar", trust: "Reference" } },
  { id: "cola-classic", name: "Cola · full sugar", brand: "Coca-Cola", amount: 100, unit: "ml", calories: 44, protein: 0, carbs: 10.9, fat: 0, fiber: 0, category: "Ordered", availability: "Amazon · 750 ml bottle", aliases: ["coca cola", "coke", "cola", "soft drink"], source: { label: "Coca-Cola India · Classic product page", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-coca-cola", trust: "Official label" } },

  // --- Branded snacks and staples KP buys, transcribed from published panels.
  { id: "parle-g", name: "Parle-G glucose biscuits", brand: "Parle", amount: 100, unit: "g", calories: 454, protein: 6.9, carbs: 77.3, fat: 13, fiber: 0, category: "Ordered", availability: "Instamart · about 5.5 g per biscuit", aliases: ["parle g", "glucose biscuit", "biscuit", "parleg"], source: labelMirror("Published panel · Parle-G original", "https://www.fatsecret.co.in/calories-nutrition/parle/parle-g-biscuits/100g") },
  { id: "maggi-masala-noodles", name: "2-Minute masala noodles", brand: "MAGGI", amount: 100, unit: "g", calories: 443, protein: 8.6, carbs: 61.4, fat: 18.6, fiber: 2.9, category: "Ordered", availability: "Amazon / Instamart · 70 g cake per pack", aliases: ["maggi", "noodles", "instant noodles", "masala noodles"], source: labelMirror("Published panel · masala variant", "https://www.fatsecret.co.in/calories-nutrition/maggi/2-minute-noodles/100g") },
  { id: "milkymist-skyr", name: "Skyr high-protein yogurt", brand: "Milky Mist", amount: 100, unit: "g", calories: 100, protein: 12, carbs: 10, fat: 1.5, fiber: 0, category: "Ordered", availability: "Amazon · 700 g and 100 g cups", aliases: ["skyr", "milky mist", "high protein yogurt", "icelandic yogurt"], source: labelMirror("Published panel · Skyr plain", "https://www.fatsecret.co.in/calories-nutrition/milky-mist/skyr-high-protein-plain-yogurt/100g") },
  { id: "cadbury-dairy-milk", name: "Dairy Milk chocolate", brand: "Cadbury", amount: 100, unit: "g", calories: 531, protein: 7.9, carbs: 60.4, fat: 29, fiber: 0, category: "Ordered", availability: "Amazon / Instamart · 20.2 g bar", aliases: ["cadbury", "dairy milk", "chocolate", "nutties"], source: labelMirror("Published panel · Dairy Milk India", "https://world.openfoodfacts.org/product/7622202245558/cadbury-dairy-milk") },
  { id: "lays-potato-chips", name: "Potato chips · India's Magic Masala", brand: "Lay's", amount: 100, unit: "g", calories: 555, protein: 6.9, carbs: 51.4, fat: 35.7, fiber: 0, category: "Ordered", availability: "Instamart · 52 g pack", aliases: ["lays", "chips", "crisps", "potato chips", "kurkure"], source: labelMirror("Published panel · India's Magic Masala", "https://www.nutritionix.com/i/lays/potato-chips-indias-magic-masala/5c67b60aabe9573e67448639") },
  { id: "slurrp-farm-cookies", name: "Multigrain cookies · no maida", brand: "Slurrp Farm", amount: 100, unit: "g", calories: 492, protein: 5, carbs: 70, fat: 21.32, fiber: 1.11, category: "Ordered", availability: "Amazon · 80 g pack · panel is for the banana oat variant", aliases: ["slurrp farm", "cookies", "ragi cookies", "banana oat cookies"], source: labelMirror("Published panel · banana oat variant", "https://www.amazon.in/Slurrp-Farm-Healthy-Wholegrain-Transfat/dp/B01M0YIW34") },

  // --- Generic Indian staples, spices and produce from composition tables.
  { id: "rusk-toast", name: "Rusk · bakery toast", amount: 100, unit: "g", calories: 407, protein: 13.5, carbs: 72.3, fat: 7.2, fiber: 2.5, category: "Ingredient", availability: "Bengaluru bakeries", aliases: ["rusk", "toast", "iyengar"], source: usdaSource },
  { id: "murukku", name: "Murukku · fried snack", amount: 100, unit: "g", calories: 500, protein: 10, carbs: 60, fat: 24, fiber: 4, category: "Ingredient", availability: "Deep-fried; varies 450–570 kcal by recipe", aliases: ["murukku", "chakli", "mixture", "namkeen", "madras mixture"], source: ifctSource },
  { id: "coconut-water", name: "Coconut water", amount: 100, unit: "ml", calories: 19, protein: 0.72, carbs: 3.71, fat: 0.2, fiber: 1.1, category: "Ingredient", availability: "Bengaluru staple", aliases: ["coconut water", "nariyal pani", "tender coconut"], source: usdaSource },
  { id: "lemongrass", name: "Lemongrass · raw", amount: 100, unit: "g", calories: 99, protein: 1.8, carbs: 25.3, fat: 0.5, fiber: 0, category: "Ingredient", availability: "Bengaluru produce", aliases: ["lemon grass", "lemongrass", "citronella"], source: usdaSource },
  { id: "lemon", name: "Lemon · raw", amount: 100, unit: "g", calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8, category: "Ingredient", availability: "Bengaluru produce", aliases: ["lemon", "nimbu", "lime"], source: usdaSource },
  { id: "ginger", name: "Ginger · raw", amount: 100, unit: "g", calories: 80, protein: 1.8, carbs: 17.8, fat: 0.8, fiber: 2, category: "Ingredient", availability: "Bengaluru produce", aliases: ["ginger", "adrak", "shunti"], source: usdaSource },
  { id: "coriander-leaves", name: "Coriander leaves · raw", amount: 100, unit: "g", calories: 23, protein: 2.1, carbs: 3.7, fat: 0.5, fiber: 2.8, category: "Ingredient", availability: "Bengaluru produce", aliases: ["coriander", "dhania", "cilantro", "kottambari"], source: usdaSource },
  { id: "mint-leaves", name: "Mint leaves · raw", amount: 100, unit: "g", calories: 44, protein: 3.3, carbs: 8.4, fat: 0.7, fiber: 6.8, category: "Ingredient", availability: "Bengaluru produce", aliases: ["mint", "pudina"], source: usdaSource },
  { id: "sugar-white", name: "Sugar · white granulated", amount: 100, unit: "g", calories: 400, protein: 0, carbs: 100, fat: 0, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["sugar", "cheeni", "granulated sugar"], source: usdaSource },
  { id: "tamarind-pulp", name: "Tamarind · seedless pulp", amount: 100, unit: "g", calories: 239, protein: 2.8, carbs: 62.5, fat: 0.6, fiber: 5.1, category: "Ingredient", availability: "Bengaluru staple", aliases: ["tamarind", "imli", "emli", "puli"], source: usdaSource },
  { id: "rice-flour", name: "Rice flour", amount: 100, unit: "g", calories: 366, protein: 5.9, carbs: 80.1, fat: 1.4, fiber: 2.4, category: "Ingredient", availability: "Bengaluru staple", aliases: ["rice flour", "akki hittu", "chawal atta"], source: usdaSource },
  { id: "corn-starch", name: "Corn starch · cornflour", amount: 100, unit: "g", calories: 381, protein: 0.3, carbs: 91.3, fat: 0.1, fiber: 0.9, category: "Ingredient", availability: "Baking aisle", aliases: ["corn starch", "cornflour", "corn flour"], source: usdaSource },
  { id: "kala-chana-dry", name: "Kala chana · black chickpea, dry", amount: 100, unit: "g", calories: 360, protein: 17.1, carbs: 60.9, fat: 5.3, fiber: 12, category: "Ingredient", availability: "Bengaluru staple", aliases: ["kala chana", "black chana", "bengal gram", "chana"], source: ifctSource },
  { id: "chilli-powder", name: "Red chilli powder", amount: 100, unit: "g", calories: 282, protein: 12, carbs: 49.7, fat: 14.3, fiber: 34.8, category: "Ingredient", availability: "Bengaluru staple · used in grams", aliases: ["chilli powder", "lal mirch", "red chilli", "chili"], source: usdaSource },
  { id: "cumin-seed", name: "Cumin · jeera", amount: 100, unit: "g", calories: 375, protein: 17.8, carbs: 44.2, fat: 22.3, fiber: 10.5, category: "Ingredient", availability: "Bengaluru staple · used in grams", aliases: ["jeera", "cumin", "jeera powder", "jeera whole"], source: usdaSource },
  { id: "coriander-powder", name: "Coriander powder · dhania", amount: 100, unit: "g", calories: 298, protein: 12.4, carbs: 55, fat: 17.8, fiber: 41.9, category: "Ingredient", availability: "Bengaluru staple · used in grams", aliases: ["coriander powder", "dhania powder", "malli"], source: usdaSource },
  { id: "tea-brewed", name: "Tea · brewed, no milk", amount: 100, unit: "ml", calories: 1, protein: 0, carbs: 0.3, fat: 0, fiber: 0, category: "Ingredient", availability: "Leaf tea, black, unsweetened", aliases: ["tea", "chai", "leaf tea", "black tea"], source: usdaSource },

  // Exact retailer-title products. These are intentionally separate from generic/category
  // references: cardIQ may attach them only when brand, item and variant all match.
  { id: "amul-lactose-free", name: "Lactose Free Milk", brand: "Amul", variant: "250 ml pack", amount: 250, unit: "ml", calories: 148, protein: 7.5, carbs: 12, fat: 7.8, fiber: 0, category: "Ordered", availability: "Amazon India / Amul", aliases: ["lactose free milk", "amul milk"], conversions: [{ unit: "pack", basisAmount: 250, label: "1 pack" }], source: { label: "Amul official · 250 ml pack", url: "https://uat.amul.com/products/amul-lactose-info.php", trust: "Official label" } },
  { id: "nandini-paneer", name: "Paneer", brand: "Nandini", variant: "200 g pack", amount: 100, unit: "g", calories: 297, protein: 18.6, carbs: 4.5, fat: 22.7, fiber: 0, category: "Ordered", availability: "Amazon India / JioMart", aliases: ["nandini cottage cheese", "nandini paneer"], conversions: [{ unit: "pack", basisAmount: 200, label: "1 pack" }], source: { label: "Current 200 g pack label", url: "https://www.jiomart.com/p/groceries/nandini-paneer-200-gm/490011331", trust: "Label mirror" } },
  { id: "akshayakalpa-amrutha-a2", name: "Amrutha A2 Cow Milk", brand: "Akshayakalpa", variant: "Organic · 500 ml", amount: 100, unit: "ml", calories: 61.5, protein: 3.3, carbs: 4.2, fat: 3.5, fiber: 0, category: "Ordered", availability: "Amazon India / Bengaluru", aliases: ["a2 milk", "akshayakalpa milk"], conversions: [{ unit: "pack", basisAmount: 500, label: "1 pouch" }], source: { label: "Current pack-label mirror", url: "https://flowcery.com/products/akshayakalpa-amrutha-a2-pasteurised-milk-organic", trust: "Label mirror" } },
  { id: "epigamia-turbo-cookies-cream", name: "Turbo Protein Milkshake", brand: "Epigamia", variant: "Cookies & Cream · 250 ml", amount: 250, unit: "ml", calories: 137, protein: 25, carbs: 9, fat: 0.2, fiber: 0, category: "Ordered", availability: "Amazon India / Epigamia", aliases: ["turbo milkshake", "cookies cream protein shake"], conversions: [{ unit: "pack", basisAmount: 250, label: "1 bottle" }], source: { label: "Epigamia official · current 250 ml label", url: "https://epigamiastore.com/products/copy-of-turbo-25-g-protein-milkshake-cookies-cream-250-ml-v-epigamia", trust: "Official label" } },
  { id: "yogabar-protein-shake-cold-coffee", name: "26g Protein Shake", brand: "Yogabar", variant: "Cold Coffee · 250 ml", amount: 250, unit: "ml", calories: 220, protein: 26, carbs: 26.3, fat: 1.2, fiber: 0, category: "Ordered", availability: "Amazon India / Yogabar", aliases: ["cold coffee protein shake", "yogabar shake"], conversions: [{ unit: "pack", basisAmount: 250, label: "1 bottle" }], source: { label: "Yogabar official · current 250 ml label", url: "https://www.yogabars.in/products/26g-protein-shake-cold-coffee-pack-of-24", trust: "Official label" } },
  { id: "raw-pressery-coconut-water", name: "Coconut Water", brand: "Raw Pressery", variant: "200 ml", amount: 200, unit: "ml", calories: 49.56, protein: 0.38, carbs: 11.2, fat: 0.36, fiber: 1.7, category: "Ordered", availability: "BigBasket / StarQuik", aliases: ["coconut water", "raw pressery"], conversions: [{ unit: "pack", basisAmount: 200, label: "1 pack" }], source: { label: "Current 200 ml pack label", url: "https://www.starquik.com/products/raw-pressery-coconut-water-200-ml-sc-sm57", trust: "Label mirror" } },
  { id: "amul-processed-cheese-block", name: "Processed Cheese Block", brand: "Amul", variant: "200 g", amount: 100, unit: "g", calories: 311, protein: 20, carbs: 1.5, fat: 25, fiber: 0, category: "Ordered", availability: "Amazon India / BigBasket", aliases: ["amul cheese block", "processed cheese"], conversions: [{ unit: "pack", basisAmount: 200, label: "1 block" }], source: { label: "Current BigBasket pack label", url: "https://www.bigbasket.com/pd/40003788/amul-processed-cheese-block-200-g-carton/", trust: "Label mirror" } },
  { id: "coca-cola-original", name: "Coca-Cola", brand: "Coca-Cola", variant: "Original · 750 ml bottle", amount: 100, unit: "ml", calories: 44, protein: 0, carbs: 10.9, fat: 0, fiber: 0, category: "Ordered", availability: "India", aliases: ["coke", "cola"], conversions: [{ unit: "pack", basisAmount: 750, label: "1 bottle" }], source: { label: "Coca-Cola India official", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-coca-cola", trust: "Official label" } },
  { id: "coca-cola-zero", name: "Coca-Cola", brand: "Coca-Cola", variant: "Zero Sugar · 750 ml bottle", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Ordered", availability: "India", aliases: ["coke zero", "zero sugar cola"], conversions: [{ unit: "pack", basisAmount: 750, label: "1 bottle" }], source: { label: "Coca-Cola India official", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-coca-cola-zero-sugar", trust: "Official label" } },
  { id: "coca-cola-zero-250", name: "Coca-Cola", brand: "Coca-Cola", variant: "Zero Sugar · 8 × 250 ml bottles", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Ordered", availability: "India", aliases: ["coke zero", "zero sugar cola"], conversions: [{ unit: "piece", basisAmount: 250, label: "1 bottle" }, { unit: "pack", basisAmount: 2000, label: "1 retailer pack (8 bottles)" }], source: { label: "Coca-Cola India official", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-coca-cola-zero-sugar", trust: "Official label" } },
  { id: "diet-coke", name: "Diet Coke", brand: "Coca-Cola", variant: "India · 300 ml can", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Ordered", availability: "India", aliases: ["coca cola diet", "diet cola"], conversions: [{ unit: "pack", basisAmount: 300, label: "1 can" }], source: { label: "Coca-Cola India official", url: "https://www.coca-cola.com/in/en/brands/coca-cola/products-diet-coke", trust: "Official label" } },
  { id: "kinley-soda", name: "Soda Water", brand: "Kinley", variant: "Strong · Original · 750 ml bottle", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Ordered", availability: "India", aliases: ["kinley strong soda", "soda water"], conversions: [{ unit: "pack", basisAmount: 750, label: "1 bottle" }], source: { label: "Coca-Cola India official", url: "https://www.coca-cola.com/in/en/brands/kinley/product-kinley", trust: "Official label" } },

  // --- Third research pass (2026-08-10): panels found for the products KP buys that a
  // packaged-label search hadn't reached yet. Same acceptance rule as the earlier batches —
  // stated energy must agree with the macros within tolerance, checked in
  // tests/prototype-logic.test.ts.
  { id: "sids-farm-high-protein-milk", name: "High Protein Milk", brand: "Sid's Farm", amount: 100, unit: "ml", calories: 63.2, protein: 10, carbs: 5.46, fat: 0.2, fiber: 0, category: "Ordered", availability: "Amazon · 250 ml pack, no added whey", aliases: ["high protein milk", "sids farm", "sid's farm"], source: labelMirror("Published panel · 250 ml pack", "https://www.fatsecret.co.in/calories-nutrition/sids-farm/high-protein-milk/1-serving") },
  { id: "act2-popcorn-sour-cream-cheese", name: "Ready to Eat Popcorn · Sour Cream & Cheese", brand: "ACT II", amount: 100, unit: "g", calories: 496, protein: 8.3, carbs: 56, fat: 29, fiber: 11.3, category: "Ordered", availability: "Instamart", aliases: ["act ii", "popcorn", "ready to eat popcorn"], source: labelMirror("Published panel", "https://www.fatsecret.co.in/calories-nutrition/act-ii/sour-cream-cheese/100g") },
  { id: "cadbury-nutties", name: "Nutties chocolate", brand: "Cadbury", amount: 100, unit: "g", calories: 511, protein: 5, carbs: 67.2, fat: 24.8, fiber: 2.5, category: "Ordered", availability: "Instamart", aliases: ["cadbury nutties", "nutties", "chocolate"], source: labelMirror("Open Food Facts · label photo, barcode 7622202031618", "https://world.openfoodfacts.org/product/7622202031618/nutties-cadbury") },
  { id: "weikfield-custard-powder", name: "Custard Powder · vanilla, dry", brand: "Weikfield", amount: 100, unit: "g", calories: 342, protein: 0.4, carbs: 88, fat: 0.1, fiber: 0, category: "Ordered", availability: "Amazon · 100 g pack, before adding milk", aliases: ["custard powder", "weikfield", "custard"], source: labelMirror("Published panel · dry powder", "https://www.fatsecret.co.in/calories-nutrition/weikfield/custard-powder/100g") },
  { id: "kurkure-masala-munch", name: "Namkeen · Masala Munch", brand: "Kurkure", amount: 100, unit: "g", calories: 555, protein: 6, carbs: 57.3, fat: 33.6, fiber: 0, category: "Ordered", availability: "Instamart", aliases: ["kurkure", "masala munch", "namkeen"], source: labelMirror("Published panel", "https://www.fatsecret.co.in/calories-nutrition/kurkure/masala-munch/100g") },
  { id: "kinley-strong-soda", name: "Strong Soda · original, zero cal", brand: "Kinley", amount: 100, unit: "ml", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Ordered", availability: "Amazon · 750 ml bottle", aliases: ["kinley", "strong soda", "soda", "soda water"], source: labelMirror("Published panel · Strong Soda Original", "https://fitia.app/calories-nutritional-information/strong-soda-original-F6mn9h3ehs/") },
  { id: "getaway-choc-brownie-fudge-icecream", name: "High-protein ice cream · Chocolate Brownie Fudge", brand: "Get-A-Way", amount: 100, unit: "g", calories: 182, protein: 13.4, carbs: 13, fat: 8.5, fiber: 2.08, category: "Ordered", availability: "Instamart · high-protein dessert brand", aliases: ["get a way", "getaway", "ice cream", "brownie fudge"], source: labelMirror("Published panel", "https://www.eatthismuch.com/food/nutrition/ice-cream-chocolate-brownie-fudge,2058060/") },
  { id: "health-factory-pizza-base", name: "Zero Maida Pizza Base", brand: "The Health Factory", amount: 100, unit: "g", calories: 239.7, protein: 13.4, carbs: 43.51, fat: 1.34, fiber: 6.38, category: "Ordered", availability: "Instamart · 100% whole wheat", aliases: ["pizza base", "health factory", "zero maida"], source: labelMirror("Published panel", "https://www.fatsecret.co.in/calories-nutrition/the-health-factory/zero-maida-pizza-base/1-serving") },
  { id: "tang-orange-drink-mix", name: "Instant Drink Mix · orange, dry powder", brand: "Tang", amount: 100, unit: "g", calories: 380, protein: 0, carbs: 95, fat: 0, fiber: 0, category: "Ordered", availability: "Instamart · before mixing with water", aliases: ["tang", "drink mix", "orange drink"], source: labelMirror("Published panel · dry powder", "https://tools.myfooddata.com/nutrition-facts/2577109/wt1") },
  { id: "monk-fruit-sweetener", name: "Monk fruit sweetener · zero calorie", amount: 100, unit: "g", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, category: "Product", availability: "Sweetmate, Zeeero and similar zero-calorie sugar substitutes", aliases: ["monk fruit", "sweetmate", "zeeero", "sweetener", "sugar substitute"], source: { label: "Manufacturer zero-calorie claim, both brands", url: "https://sweetmate.in/products/sweetmate-monk-fruit-sweetener-without-erythritol-pure-monkfruit-extract-zero-calorie-sugar-substitute-1-1-sugar-replacer-for-cooking-baking-keto-diabetic-friendly", trust: "Reference" } },
  { id: "pav-bread", name: "Pav · soft bread roll", amount: 100, unit: "g", calories: 288, protein: 7.6, carbs: 56.2, fat: 3.7, fiber: 0, category: "Ingredient", availability: "Reference panel (Britannia); SMOOR and other bakery pav are close in composition", aliases: ["pav", "pav bun", "bread roll", "ladi pav"], source: referencedPanel("Published panel · Britannia Pav Bread, a different brand", "https://www.fatsecret.co.in/calories-nutrition/britannia/pav-bread/100g") },
  { id: "chana-jor-namkeen", name: "Chana jor namkeen · roasted, flattened", amount: 100, unit: "g", calories: 517, protein: 15.1, carbs: 50.5, fat: 28.3, fiber: 0, category: "Ingredient", availability: "Reference panel (Haldiram's); other brands cluster within a few percent", aliases: ["chana jor", "chana jor garam", "bhujialalji"], source: referencedPanel("Published panel · Haldiram's Chana Jor Garam, a different brand", "https://tools.myfooddata.com/nutrition-facts/102136813/wt1/1") },
];

/**
 * Older reference ingredients did not carry a commercial brand. The editor still requires
 * a visible identity, so they receive the explicit "Generic" brand instead of an empty or
 * ambiguous field. Every commercial product keeps its real brand and optional variant.
 */
export const nutritionItems: NutritionItem[] = nutritionSeedItems.map((item) => ({
  ...item,
  brand: item.brand?.trim() || "Generic",
  variant: item.variant?.trim() || "",
}));

type MealSeed = Omit<Meal, "calories" | "protein" | "carbs" | "fat" | "fiber">;

export function calculateMealNutrition(basis: Meal["nutritionBasis"]) {
  const totals = basis.reduce((sum, ingredient) => {
    const food = nutritionItems.find((item) => item.id === ingredient.foodId);
    if (!food || !Number.isFinite(ingredient.amount) || ingredient.amount <= 0 || food.amount <= 0) {
      throw new Error(`Invalid meal ingredient: ${ingredient.foodId}`);
    }
    const scale = ingredient.amount / food.amount;
    return {
      calories: sum.calories + food.calories * scale,
      protein: sum.protein + food.protein * scale,
      carbs: sum.carbs + food.carbs * scale,
      fat: sum.fat + food.fat * scale,
      fiber: sum.fiber + food.fiber * scale,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const rounded = (value: number) => Math.round(value * 10) / 10;
  return {
    calories: Math.round(totals.calories),
    protein: rounded(totals.protein),
    carbs: rounded(totals.carbs),
    fat: rounded(totals.fat),
    fiber: rounded(totals.fiber),
  };
}

const mealSeeds: MealSeed[] = [
  {
    id: "protein-brownies",
    name: "Fudgy banana protein brownies",
    serving: "¼ tray · about 3 squares",
    time: "35 min",
    totalMinutes: 35,
    tags: ["Vegetarian", "Dessert"],
    art: "brownie",
    description: "Dark cocoa, banana and oats keep these properly fudgy; whey and Greek yogurt lift the protein without butter or refined flour.",
    ingredients: ["2 medium bananas · 236 g", "Rolled oats · 80 g", "Biozyme whey · 2 scoops / 66 g", "Unsweetened cocoa · 30 g", "Non-fat Greek yogurt · 200 g", "Egg whites · 100 g"],
    nutritionBasis: [{ foodId: "banana", amount: 59 }, { foodId: "oats", amount: 20 }, { foodId: "muscleblaze-biozyme-whey", amount: 0.5 }, { foodId: "cocoa", amount: 7.5 }, { foodId: "greek-yogurt-nonfat", amount: 50 }, { foodId: "egg-whites", amount: 25 }],
    method: ["Blend everything until smooth.", "Bake in a lined 20 cm tin at 175°C for 20–24 minutes.", "Cool fully; divide into four equal servings."],
    sourceNote: "Calculated as one quarter of the weighed recipe using USDA FoodData Central plus the current whey label. No added sugar or butter.",
  },
  {
    id: "chia-cardamom-bowl",
    name: "Cardamom chia protein bowl",
    serving: "1 breakfast bowl",
    time: "10 min + chill",
    totalMinutes: 130,
    tags: ["Vegetarian", "No cook"],
    art: "chia",
    description: "Chia pudding meets Indian shrikhand notes: cardamom, thick yogurt, berries and half a scoop of whey.",
    ingredients: ["Chia seeds · 25 g", "Non-fat Greek yogurt · 200 g", "Nandini toned milk · 100 ml", "Strawberries · 100 g", "Biozyme whey · ½ scoop", "Cardamom + pinch of salt"],
    nutritionBasis: [{ foodId: "chia", amount: 25 }, { foodId: "greek-yogurt-nonfat", amount: 200 }, { foodId: "nandini-goodlife-toned", amount: 100 }, { foodId: "strawberries", amount: 100 }, { foodId: "muscleblaze-biozyme-whey", amount: 0.5 }],
    method: ["Whisk milk, yogurt, whey and cardamom.", "Stir in chia; chill at least 2 hours.", "Top with fruit immediately before eating."],
    sourceNote: "Ingredient-weight calculation from USDA reference foods and current product labels; fruit choice can shift totals slightly.",
  },
  {
    id: "cauli-chicken",
    name: "Pepper chicken cauliflower rice",
    serving: "1 large bowl",
    time: "30 min",
    totalMinutes: 30,
    tags: ["Gluten free"],
    art: "cauli",
    description: "A genuinely filling cauliflower-rice bowl with pepper chicken, peas, beans, ginger and a bright lime finish.",
    ingredients: ["Cooked chicken breast · 150 g", "Cauliflower · 250 g", "Green peas · 50 g", "Green beans · 50 g", "Capsicum · 50 g", "Oil · 2 g", "Ginger, pepper, lime, coriander"],
    nutritionBasis: [{ foodId: "chicken-breast", amount: 150 }, { foodId: "cauliflower", amount: 250 }, { foodId: "green-peas-cooked", amount: 50 }, { foodId: "green-beans", amount: 50 }, { foodId: "capsicum", amount: 50 }, { foodId: "oil", amount: 2 }],
    method: ["Pulse cauliflower into rice-sized pieces.", "Sear spiced chicken in a non-stick pan; set aside.", "Stir-fry vegetables and cauliflower, then fold chicken through."],
    sourceNote: "Calculated from weighed USDA reference ingredients. The 2 g oil quantity is included, not treated as a free food.",
  },
  {
    id: "paneer-quinoa-tikka",
    name: "High-protein paneer tikka quinoa bowl",
    serving: "1 generous bowl",
    time: "35 min",
    totalMinutes: 35,
    tags: ["Vegetarian"],
    art: "paneer",
    description: "Low-fat paneer, quinoa, charred vegetables and mint yogurt—tikka-shop satisfaction with every ingredient weighed.",
    ingredients: ["Amul High Protein Paneer · 150 g", "Cooked quinoa · 150 g", "Capsicum · 70 g", "Onion · 65 g", "Tomato · 65 g", "Non-fat mint yogurt · 100 g", "Tikka masala + lemon"],
    nutritionBasis: [{ foodId: "amul-high-protein-paneer", amount: 150 }, { foodId: "quinoa-cooked", amount: 150 }, { foodId: "capsicum", amount: 70 }, { foodId: "onion", amount: 65 }, { foodId: "tomato", amount: 65 }, { foodId: "greek-yogurt-nonfat", amount: 100 }],
    method: ["Marinate paneer and vegetables in half the yogurt and spices.", "Air-fry or grill until charred.", "Serve over quinoa with the remaining mint yogurt."],
    sourceNote: "Calculated from Amul’s official paneer label plus USDA reference ingredients.",
  },
  {
    id: "rajma-quinoa",
    name: "Rajma quinoa kachumber bowl",
    serving: "1 hearty bowl",
    time: "25 min with cooked beans",
    totalMinutes: 25,
    tags: ["Vegan", "Meal prep"],
    art: "rajma",
    description: "Rajma comfort with quinoa, a large kachumber and controlled oil; unusually high fibre without feeling worthy or austere.",
    ingredients: ["Cooked rajma · 150 g", "Cooked quinoa · 150 g", "Tomato · 50 g", "Cucumber · 50 g", "Onion · 50 g", "Oil · 5 g", "Rajma masala, lemon, coriander"],
    nutritionBasis: [{ foodId: "rajma-cooked", amount: 150 }, { foodId: "quinoa-cooked", amount: 150 }, { foodId: "tomato", amount: 50 }, { foodId: "cucumber", amount: 50 }, { foodId: "onion", amount: 50 }, { foodId: "oil", amount: 5 }],
    method: ["Warm rajma with masala and a splash of water.", "Season the chopped kachumber with lemon.", "Layer quinoa, rajma and salad; include the measured oil in cooking."],
    sourceNote: "Calculated from cooked USDA reference foods; bean variety and retained cooking liquid can shift totals.",
  },
  {
    id: "oats-egg-uttapam",
    name: "Oats egg-white uttapam plate",
    serving: "3 small uttapams + yogurt",
    time: "25 min",
    totalMinutes: 25,
    tags: ["Breakfast"],
    art: "uttapam",
    description: "A crisp-edged oats batter packed with egg whites and vegetables, with cool yogurt instead of an oil-heavy chutney.",
    ingredients: ["Rolled oats · 40 g", "Egg whites · 200 g", "Onion · 50 g", "Tomato · 50 g", "Carrot · 50 g", "Non-fat Greek yogurt · 100 g", "Oil · 5 g", "Chilli, curry leaves, cumin"],
    nutritionBasis: [{ foodId: "oats", amount: 40 }, { foodId: "egg-whites", amount: 200 }, { foodId: "onion", amount: 50 }, { foodId: "tomato", amount: 50 }, { foodId: "carrot", amount: 50 }, { foodId: "greek-yogurt-nonfat", amount: 100 }, { foodId: "oil", amount: 5 }],
    method: ["Blend oats, egg whites and spices into a pourable batter.", "Fold in chopped vegetables.", "Cook three uttapams using all 5 g measured oil; serve with yogurt."],
    sourceNote: "Calculated from USDA reference ingredients. The full cooking-oil allowance is included.",
  },
  {
    id: "cocoa-banana-chia",
    name: "Chocolate banana chia pudding",
    serving: "1 dessert bowl",
    time: "10 min + chill",
    totalMinutes: 130,
    tags: ["Vegetarian", "Dessert"],
    art: "cocoa",
    description: "The spoonable, deeply chocolate cousin of a protein shake—banana-sweetened and loaded with chia and cocoa fibre.",
    ingredients: ["Chia seeds · 25 g", "Non-fat Greek yogurt · 200 g", "Banana · 100 g", "Unsweetened cocoa · 10 g", "Biozyme whey · ½ scoop", "Water + pinch of salt"],
    nutritionBasis: [{ foodId: "chia", amount: 25 }, { foodId: "greek-yogurt-nonfat", amount: 200 }, { foodId: "banana", amount: 100 }, { foodId: "cocoa", amount: 10 }, { foodId: "muscleblaze-biozyme-whey", amount: 0.5 }],
    method: ["Blend banana, yogurt, whey, cocoa and water.", "Stir through chia.", "Chill for at least 2 hours; loosen with water if needed."],
    sourceNote: "Calculated from USDA reference ingredients and the current whey label.",
  },
  {
    id: "palak-paneer",
    name: "Lean palak paneer skillet",
    serving: "1 main bowl",
    time: "30 min",
    totalMinutes: 30,
    tags: ["Vegetarian", "Gluten free"],
    art: "palak",
    description: "A spinach-heavy palak paneer using high-protein paneer and yogurt for body instead of cream.",
    ingredients: ["Amul High Protein Paneer · 150 g", "Spinach · 200 g", "Onion · 75 g", "Tomato · 75 g", "Non-fat Greek yogurt · 100 g", "Oil · 2 g", "Ginger, garlic, garam masala"],
    nutritionBasis: [{ foodId: "amul-high-protein-paneer", amount: 150 }, { foodId: "spinach", amount: 200 }, { foodId: "onion", amount: 75 }, { foodId: "tomato", amount: 75 }, { foodId: "greek-yogurt-nonfat", amount: 100 }, { foodId: "oil", amount: 2 }],
    method: ["Wilt and blend spinach with ginger and chilli.", "Cook onion-tomato masala in measured oil.", "Fold in spinach, yogurt and paneer; warm gently."],
    sourceNote: "Calculated from Amul’s official paneer label plus USDA reference ingredients. Yogurt replaces cream.",
  },
  {
    id: "tandoori-quinoa",
    name: "Tandoori chicken quinoa kachumber",
    serving: "1 dinner plate",
    time: "40 min",
    totalMinutes: 40,
    tags: ["Meal prep"],
    art: "tandoori",
    description: "Charred yogurt-marinated chicken, quinoa and a mountain of kachumber—big dinner energy with a lean macro shape.",
    ingredients: ["Cooked chicken breast · 150 g", "Cooked quinoa · 150 g", "Cucumber · 70 g", "Tomato · 65 g", "Onion · 65 g", "Non-fat Greek yogurt · 100 g", "Tandoori spices, lemon, coriander"],
    nutritionBasis: [{ foodId: "chicken-breast", amount: 150 }, { foodId: "quinoa-cooked", amount: 150 }, { foodId: "cucumber", amount: 70 }, { foodId: "tomato", amount: 65 }, { foodId: "onion", amount: 65 }, { foodId: "greek-yogurt-nonfat", amount: 100 }],
    method: ["Marinate chicken in yogurt, lemon and spices.", "Grill or air-fry until cooked and lightly charred.", "Plate with quinoa and a large chopped kachumber."],
    sourceNote: "Calculated from USDA reference ingredients; no invisible oil is assumed.",
  },
  {
    id: "greek-yogurt-chaat",
    name: "Crunchy Greek-yogurt chana chaat",
    serving: "1 lunch bowl",
    time: "15 min",
    totalMinutes: 15,
    tags: ["Vegetarian", "No cook"],
    art: "chaat",
    description: "Creamy, tangy chaat built around yogurt and chickpeas, with chia for crunch and no fried sev hiding in the arithmetic.",
    ingredients: ["Natural Greek yogurt · 270 g", "Cooked chickpeas · 100 g", "Cucumber · 50 g", "Tomato · 50 g", "Onion · 50 g", "Chia seeds · 10 g", "Chaat masala, mint, lemon"],
    nutritionBasis: [{ foodId: "epigamia-natural-greek", amount: 270 }, { foodId: "chickpeas-cooked", amount: 100 }, { foodId: "cucumber", amount: 50 }, { foodId: "tomato", amount: 50 }, { foodId: "onion", amount: 50 }, { foodId: "chia", amount: 10 }],
    method: ["Season yogurt with mint and chaat masala.", "Fold through chickpeas and chopped vegetables.", "Finish with chia, lemon and coriander."],
    sourceNote: "Calculated from product-label yogurt and USDA reference ingredients; recheck the exact yogurt pack before production use.",
  },
];

const NUMERIC_TAGS = ["High protein", "Low fat", "High fibre"] as const;

/**
 * The three numeric badges are derived, never typed by hand, so a badge can never
 * disagree with the number printed beside it after an ingredient changes.
 */
export function numericTags(nutrition: { protein: number; fat: number; fiber: number }) {
  return [
    ...(nutrition.protein >= 25 ? ["High protein"] : []),
    ...(nutrition.fat <= 10 ? ["Low fat"] : []),
    ...(nutrition.fiber >= 8 ? ["High fibre"] : []),
  ];
}

export const meals: Meal[] = mealSeeds.map((seed) => {
  const nutrition = calculateMealNutrition(seed.nutritionBasis);
  return { ...seed, ...nutrition, tags: [...numericTags(nutrition), ...seed.tags.filter((tag) => !NUMERIC_TAGS.includes(tag as typeof NUMERIC_TAGS[number]))] };
});
