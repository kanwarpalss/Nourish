export type NutritionSource = {
  label: string;
  url: string;
  trust: "Official label" | "Reference" | "Label mirror";
};

export type NutritionItem = {
  id: string;
  name: string;
  brand?: string;
  amount: number;
  unit: "g" | "ml" | "scoop" | "pack" | "piece" | "serving";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: "Ordered" | "Product" | "Ingredient" | "Meal";
  availability: string;
  common?: boolean;
  aliases: string[];
  source: NutritionSource;
  basis?: { amount: number; calories: number; protein: number; carbs: number; fat: number; fiber: number };
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
  ninGuidelines: "https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI24thJune2024fin.pdf",
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

export const nutritionItems: NutritionItem[] = [
  {
    id: "nandini-goodlife-toned",
    name: "GoodLife UHT toned milk",
    brand: "Nandini",
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
    source: { label: "Current retailer label · KMF product", url: "https://www.bigbasket.com/pd/100285703/nandini-goodlife-toned-milk-1-l-carton/", trust: "Label mirror" },
  },
  {
    id: "epigamia-natural-greek",
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
  { id: "banana", name: "Banana · medium", amount: 118, unit: "g", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, category: "Ingredient", availability: "Bengaluru staple", common: true, aliases: ["kela", "fruit"], source: usdaSource },
  { id: "chia", name: "Chia seeds", amount: 25, unit: "g", calories: 122, protein: 4.1, carbs: 10.5, fat: 7.7, fiber: 8.6, category: "Ingredient", availability: "BigBasket · Bengaluru", common: true, aliases: ["seeds", "omega 3", "pudding"], source: usdaSource },
  { id: "oats", name: "Rolled oats · dry", amount: 40, unit: "g", calories: 152, protein: 5.3, carbs: 27.1, fat: 2.6, fiber: 4, category: "Ingredient", availability: "Widely available in India", aliases: ["oatmeal", "porridge"], source: usdaSource },
  { id: "cauliflower", name: "Cauliflower · raw", amount: 250, unit: "g", calories: 63, protein: 4.8, carbs: 12.4, fat: 0.7, fiber: 5, category: "Ingredient", availability: "Bengaluru produce", aliases: ["gobi", "cauliflower rice", "vegetable"], source: usdaSource },
  { id: "chicken-breast", name: "Chicken breast · cooked", amount: 150, unit: "g", calories: 248, protein: 46.5, carbs: 0, fat: 5.4, fiber: 0, category: "Ingredient", availability: "Bengaluru poultry / quick commerce", aliases: ["boneless chicken", "roasted chicken"], source: usdaSource },
  { id: "rajma-cooked", name: "Rajma · cooked", amount: 150, unit: "g", calories: 191, protein: 13, carbs: 34.2, fat: 0.8, fiber: 9.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["kidney beans", "beans"], source: usdaSource },
  { id: "quinoa-cooked", name: "Quinoa · cooked", amount: 150, unit: "g", calories: 180, protein: 6.6, carbs: 31.9, fat: 2.9, fiber: 4.2, category: "Ingredient", availability: "BigBasket / supermarkets", aliases: ["grain", "seed"], source: usdaSource },
  { id: "spinach", name: "Spinach · raw", amount: 100, unit: "g", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, category: "Ingredient", availability: "Bengaluru produce", aliases: ["palak", "greens"], source: usdaSource },
  { id: "egg-whites", name: "Egg whites", amount: 100, unit: "g", calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["eggs", "albumen"], source: usdaSource },
  { id: "cocoa", name: "Unsweetened cocoa powder", amount: 20, unit: "g", calories: 46, protein: 3.9, carbs: 11.6, fat: 2.7, fiber: 7.4, category: "Ingredient", availability: "Baking aisle / online India", aliases: ["cacao", "chocolate", "brownie"], source: usdaSource },
  { id: "chickpeas-cooked", name: "Chickpeas · cooked", amount: 100, unit: "g", calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, category: "Ingredient", availability: "Bengaluru staple", aliases: ["chana", "kabuli chana", "garbanzo"], source: usdaSource },
  { id: "green-peas-cooked", name: "Green peas · cooked", amount: 100, unit: "g", calories: 84, protein: 5.4, carbs: 15.6, fat: 0.4, fiber: 5.5, category: "Ingredient", availability: "Bengaluru produce / frozen aisle", aliases: ["matar", "peas"], source: usdaSource },
  { id: "mango", name: "Mango · raw", amount: 150, unit: "g", calories: 90, protein: 1.2, carbs: 22.5, fat: 0.6, fiber: 2.4, category: "Ingredient", availability: "Seasonal Bengaluru produce", aliases: ["aam", "fruit"], source: usdaSource },
  { id: "strawberries", name: "Strawberries · raw", amount: 100, unit: "g", calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, category: "Ingredient", availability: "Seasonal / frozen Bengaluru", aliases: ["berries", "fruit"], source: usdaSource },
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
  { id: "oil", name: "Cooking oil · reference", amount: 5, unit: "g", calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0, category: "Ingredient", availability: "Bengaluru staple", aliases: ["measured oil", "fat"], source: usdaSource },
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
];

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

export const meals: Meal[] = [
  {
    id: "protein-brownies",
    name: "Fudgy banana protein brownies",
    serving: "¼ tray · about 3 squares",
    calories: 254,
    protein: 25.1,
    carbs: 35.3,
    fat: 3.7,
    fiber: 6.4,
    time: "35 min",
    totalMinutes: 35,
    tags: ["High protein", "Low fat", "Vegetarian", "Dessert"],
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
    calories: 416,
    protein: 41,
    carbs: 36.4,
    fat: 12.8,
    fiber: 11.1,
    time: "10 min + chill",
    totalMinutes: 130,
    tags: ["High protein", "High fibre", "Vegetarian", "No cook"],
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
    calories: 406,
    protein: 56,
    carbs: 27,
    fat: 8.7,
    fiber: 10.8,
    time: "30 min",
    totalMinutes: 30,
    tags: ["High protein", "Low fat", "High fibre", "Gluten free"],
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
    calories: 565,
    protein: 58.1,
    carbs: 55.6,
    fat: 13.1,
    fiber: 10.2,
    time: "35 min",
    totalMinutes: 35,
    tags: ["High protein", "Vegetarian"],
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
    calories: 466,
    protein: 22.6,
    carbs: 76,
    fat: 9.2,
    fiber: 18.3,
    time: "25 min with cooked beans",
    totalMinutes: 25,
    tags: ["Low fat", "High fibre", "Vegan", "Meal prep"],
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
    calories: 410,
    protein: 40.3,
    carbs: 42.1,
    fat: 8.9,
    fiber: 8.5,
    time: "25 min",
    totalMinutes: 25,
    tags: ["High protein", "Low fat", "Breakfast"],
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
    calories: 417,
    protein: 40.1,
    carbs: 48.2,
    fat: 11,
    fiber: 14.9,
    time: "10 min + chill",
    totalMinutes: 130,
    tags: ["High protein", "High fibre", "Vegetarian", "Dessert"],
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
    calories: 428,
    protein: 55.5,
    carbs: 27.8,
    fat: 10.6,
    fiber: 7.4,
    time: "30 min",
    totalMinutes: 30,
    tags: ["High protein", "Vegetarian", "Gluten free"],
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
    calories: 557,
    protein: 67,
    carbs: 49.5,
    fat: 9.5,
    fiber: 10.2,
    time: "40 min",
    totalMinutes: 40,
    tags: ["High protein", "Low fat", "Meal prep"],
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
    calories: 455,
    protein: 34.6,
    carbs: 50.6,
    fat: 12.2,
    fiber: 15.5,
    time: "15 min",
    totalMinutes: 15,
    tags: ["High protein", "High fibre", "Vegetarian", "No cook"],
    art: "chaat",
    description: "Creamy, tangy chaat built around yogurt and chickpeas, with chia for crunch and no fried sev hiding in the arithmetic.",
    ingredients: ["Natural Greek yogurt · 270 g", "Cooked chickpeas · 100 g", "Cucumber · 50 g", "Tomato · 50 g", "Onion · 50 g", "Chia seeds · 10 g", "Chaat masala, mint, lemon"],
    nutritionBasis: [{ foodId: "epigamia-natural-greek", amount: 270 }, { foodId: "chickpeas-cooked", amount: 100 }, { foodId: "cucumber", amount: 50 }, { foodId: "tomato", amount: 50 }, { foodId: "onion", amount: 50 }, { foodId: "chia", amount: 10 }],
    method: ["Season yogurt with mint and chaat masala.", "Fold through chickpeas and chopped vegetables.", "Finish with chia, lemon and coriander."],
    sourceNote: "Calculated from product-label yogurt and USDA reference ingredients; recheck the exact yogurt pack before production use.",
  },
].map((meal) => ({ ...meal, ...calculateMealNutrition(meal.nutritionBasis) }));
