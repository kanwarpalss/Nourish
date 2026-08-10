export type CardIqOrderItem = { name?: unknown; qty?: unknown };

export type CardIqOrder = {
  source: string;
  merchant_name: string | null;
  order_at: string;
  items: CardIqOrderItem[];
};

export type CardIqFoodItem = {
  name: string;
  store: "Amazon" | "BigBasket" | "Instamart";
  orderCount: number;
  units: number;
  lastOrdered: string;
  matchedFoodId?: string;
  matchKind?: "Exact product" | "Reference ingredient";
};

export type CardIqFoodImport = {
  schemaVersion: 1;
  generatedAt: string;
  windowStart: string;
  orderCount: number;
  items: CardIqFoodItem[];
};

/**
 * Household, personal-care, medicine, and general-merchandise purchases. These are
 * excluded for every store. Previously Instamart and BigBasket bypassed this check
 * entirely, which let toilet cleaner, antiseptic, and incense into the food catalogue.
 *
 * Terms are matched as whole words, so "cough" does not exclude "cough drops"-shaped
 * foods by accident and "cream" is deliberately absent: dairy cream and ice cream are
 * food. Non-food creams are caught by their qualifier ("moisture cream") or brand.
 */
const nonFoodTerms = [
  // cleaning and household
  "detergent", "dishwash", "dish wash", "cleaner", "cleaning", "disinfectant", "antiseptic",
  "toilet paper", "toilet cleaner", "floor cleaner", "garbage bag", "tissue", "kitchen cloth",
  "cloth", "muslin", "towel", "hanger", "mosquito", "agarbatti", "incense", "phenyl",
  // personal care
  "shampoo", "conditioner", "body wash", "shower gel", "handwash", "hand wash", "soap",
  "toothpaste", "toothbrush", "deodorant", "moisture cream", "moisturiser", "moisturizer",
  "balm", "lotion", "sunscreen", "shaving", "razor", "comb", "lice", "diaper", "sanitary",
  "skin", "hair",
  // medicine
  "cough", "syrup for", "tablet", "tablets", "capsule", "capsules", "ointment", "antacid",
  "paracetamol", "diphenhydramine", "medicine", "sanitizer", "sanitiser",
  // general merchandise
  "gift card", "fastag", "mobile bill", "charger", "car", "battery", "cable", "book",
  "paperback", "hardcover", "novel", "bestselling", "author", "glass", "pitcher", "spray",
  "bottle cap", "container", "storage box",
];

/**
 * Brands that only ever sell non-food in this order history. A brand check catches
 * products whose category word is missing or unusual (Harpic "Power Plus Stain Removal",
 * Aveeno "Soothing Relief", Chicco "for Kids").
 */
const nonFoodBrands = [
  "harpic", "dettol", "vim", "lizol", "colin", "aveeno", "aquaphor", "mcaffeine", "chicco",
  "benadryl", "mangaldeep", "presto", "rixtec", "himalaya", "nivea", "pampers", "huggies",
];

/**
 * Words meaning "this is a manufactured product, not the raw ingredient it names".
 *
 * A raw-ingredient match is refused when one of these appears, because the macros of
 * banana oat cookies, oat beverage, or cream-onion crisps have nothing to do with the
 * macros of a banana, dry rolled oats, or a raw onion. Without this guard the importer
 * assigned raw-produce nutrition to processed snacks.
 */
const processedFormTerms = [
  "cookie", "cookies", "biscuit", "biscuits", "cracker", "crackers", "rusk", "wafer",
  "chips", "crisps", "namkeen", "snack", "snacks", "mixture", "murukku", "sev", "nachos",
  "popcorn", "laddoo", "barfi", "halwa", "cake", "brownie", "pastry", "muffin", "cupcake",
  "beverage", "drink", "shake", "milkshake", "smoothie", "juice", "soda", "cola", "kombucha",
  "syrup", "sauce", "ketchup", "dip", "spread", "jam", "pickle", "chutney", "paste",
  "powder", "flour", "atta", "rava", "suji", "batter", "premix", "mix",
  "bar", "candy", "toffee", "chocolate", "ice cream", "icecream", "custard",
  "noodles", "pasta", "vermicelli", "bread", "bun", "kulcha", "roti", "paratha", "pizza",
  "flavour", "flavoured", "flavor", "flavored", "extract", "essence", "seasoning", "masala",
  "oil", "ghee", "butter", "cream",
];

/**
 * Raw ingredients whose reference nutrition is safe to reuse when the purchase is
 * unambiguously that ingredient in its raw form.
 */
const referenceMatches: Array<[string, string[]]> = [
  ["banana", ["banana", "bananas", "kela"]],
  ["carrot", ["carrot", "carrots", "gajar"]],
  ["sweet-potato", ["sweet potato", "shakarkandi", "sihi genasu"]],
  ["cucumber", ["cucumber", "kheera", "soutekaayi"]],
  ["tomato", ["tomato", "tomatoes", "tamatar"]],
  ["capsicum", ["capsicum", "bell pepper", "bell peppers", "shimla mirch"]],
  ["spinach", ["spinach", "palak"]],
  ["onion", ["onion", "onions", "pyaaz", "eerulli"]],
  ["bottle-gourd", ["bottle gourd", "doodhi", "lauki", "sorekaayi"]],
  ["broccoli", ["broccoli"]],
  ["pumpkin", ["pumpkin", "kaddu"]],
  ["whole-egg", ["egg", "eggs", "anda"]],
  ["oats", ["oat", "oats", "rolled oats"]],
  ["chia", ["chia", "chia seeds"]],
  ["peanut-butter", ["peanut butter"]],
  ["green-peas-cooked", ["green peas", "matar"]],
  ["mango", ["mango", "mangoes", "aam"]],
  ["strawberries", ["strawberry", "strawberries"]],
  ["pomegranate", ["pomegranate", "anar"]],
  ["green-beans", ["french beans", "green beans"]],
  ["cauliflower", ["cauliflower", "gobi"]],
];

/**
 * Exact products, matched against the name with all separators removed so retailer
 * spelling differences do not matter. Amazon writes "Nandini Good Life" and Instamart
 * writes "Nandini GoodLife"; both must resolve to the same product.
 *
 * Every fragment must be present, which keeps "Nandini Pasteurised Toned Milk" from
 * matching the GoodLife entry.
 */
const exactProducts: Array<{ foodId: string; fragments: string[] }> = [
  { foodId: "nandini-goodlife-toned", fragments: ["nandini", "goodlife", "toned"] },
  { foodId: "amul-high-protein-paneer", fragments: ["amul", "highprotein", "paneer"] },
  { foodId: "amul-high-protein-buttermilk", fragments: ["amul", "highprotein", "buttermilk"] },
  { foodId: "muscleblaze-biozyme-whey", fragments: ["muscleblaze", "biozyme"] },
  { foodId: "epigamia-natural-greek", fragments: ["epigamia", "greek"] },
  // Products whose panels were sourced online. Exact-product matching runs before the
  // processed-form guard, so "bread", "milkshake" and "beverage" in the name are fine here.
  { foodId: "epigamia-turbo-shake", fragments: ["epigamia", "turbo"] },
  { foodId: "milkymist-greek-yogurt", fragments: ["milkymist", "greek"] },
  { foodId: "milkymist-greek-yogurt", fragments: ["milkymistgreek"] },
  { foodId: "health-factory-protein-bread", fragments: ["healthfactory", "proteinbread"] },
  { foodId: "cosmix-plant-protein", fragments: ["cosmix"] },
  // Only the unsweetened So Good variant has a verified panel. Barista and the flavoured
  // versions differ and stay unmatched rather than borrowing this one's numbers.
  { foodId: "so-good-oat-unsweetened", fragments: ["sogood", "oat", "unsweetened"] },
  { foodId: "cola-zero-sugar", fragments: ["cocacola", "zero"] },
  { foodId: "cola-zero-sugar", fragments: ["cokezero"] },
  { foodId: "cola-zero-sugar", fragments: ["pepsizero"] },
  { foodId: "cola-zero-sugar", fragments: ["spritezero"] },
  { foodId: "cola-zero-sugar", fragments: ["cocacoladiet"] },
  // Full-sugar cola last, so every zero-sugar variant is claimed before this catch-all.
  { foodId: "cola-classic", fragments: ["cocacola"] },
  // Branded snacks. Exact matching runs before the processed-form and category-conflict
  // guards, which is what lets a biscuit or a bag of crisps carry its own real panel.
  { foodId: "parle-g", fragments: ["parleg"] },
  { foodId: "maggi-masala-noodles", fragments: ["maggi"] },
  { foodId: "milkymist-skyr", fragments: ["milkymist", "skyr"] },
  { foodId: "cadbury-dairy-milk", fragments: ["cadbury", "dairymilk"] },
  { foodId: "lays-potato-chips", fragments: ["lays", "potatochips"] },
  { foodId: "slurrp-farm-cookies", fragments: ["slurrpfarm", "cookies"] },
  { foodId: "rusk-toast", fragments: ["rusk"] },
  { foodId: "murukku", fragments: ["murukku"] },
  { foodId: "murukku", fragments: ["madrasmixture"] },
  { foodId: "coconut-water", fragments: ["coconutwater"] },
];

/**
 * Category matches for KP's real purchases.
 *
 * Indian milk grades, curd, paneer and atta are legally standardised, so the category
 * reference is accurate for any brand at that grade. These are deliberately weaker than
 * an exact pack and surface as "Reference ingredient".
 *
 * Order matters: the first entry whose fragments all appear wins, so the more specific
 * grade must come before the more general one ("skimmed" before plain "milk").
 */
const categoryProducts: Array<{ foodId: string; fragments: string[] }> = [
  // Milk grades, most specific first.
  { foodId: "milk-skimmed", fragments: ["skim"] },
  { foodId: "milk-double-toned", fragments: ["doubletoned"] },
  { foodId: "milk-full-cream", fragments: ["fullcream"] },
  { foodId: "milk-toned", fragments: ["tonedmilk"] },
  { foodId: "milk-toned", fragments: ["tonnedmilk"] },
  { foodId: "milk-toned", fragments: ["lactosefree", "milk"] },
  { foodId: "milk-cow-whole", fragments: ["cowmilk"] },
  // Curd, paneer, cheese, cream. Tofu first: it is often described as "soya paneer /
  // bean curd", which would otherwise resolve to dairy curd.
  { foodId: "tofu", fragments: ["tofu"] },
  { foodId: "paneer-whole-milk", fragments: ["paneer"] },
  { foodId: "curd-dahi", fragments: ["curd"] },
  { foodId: "cheese-slice", fragments: ["cheeseslices"] },
  { foodId: "cheese-processed", fragments: ["cheese"] },
  // Fragments are matched against the separator-free name, so a bare "cream" would also
  // hit "creamy", "creamer" and "cream onion". Only explicit cream products qualify.
  { foodId: "dairy-cream", fragments: ["dairycream"] },
  { foodId: "dairy-cream", fragments: ["uhtcream"] },
  { foodId: "dairy-cream", fragments: ["freshcream"] },
  { foodId: "dairy-cream", fragments: ["cookingcream"] },
  // Grains and flours.
  { foodId: "atta-whole-wheat", fragments: ["chakkiatta"] },
  { foodId: "atta-whole-wheat", fragments: ["wholewheatflour"] },
  { foodId: "bread-whole-wheat", fragments: ["wholewheat", "bread"] },
  { foodId: "bread-whole-wheat", fragments: ["multigrain", "bread"] },
  { foodId: "bread-white", fragments: ["sourdough"] },
  { foodId: "bread-white", fragments: ["sandwichbread"] },
  { foodId: "poha-dry", fragments: ["poha"] },
  { foodId: "vermicelli-dry", fragments: ["vermicelli"] },
  // Pulses. Retail packs are dry, which is roughly three times the cooked value.
  { foodId: "besan", fragments: ["besan"] },
  { foodId: "moong-dal-dry", fragments: ["moongdal"] },
  { foodId: "moong-dal-dry", fragments: ["moong", "dal"] },
  // Produce and snacks. Sweet potato before potato: Amazon lists it as "Potato - Sweet".
  { foodId: "sweet-potato", fragments: ["sweetpotato"] },
  { foodId: "sweet-potato", fragments: ["potatosweet"] },
  { foodId: "potato", fragments: ["potato"] },
  { foodId: "beetroot", fragments: ["beetroot"] },
  { foodId: "brinjal", fragments: ["brinjal"] },
  { foodId: "lettuce", fragments: ["lettuce"] },
  { foodId: "avocado", fragments: ["avocado"] },
  { foodId: "guava", fragments: ["guava"] },
  { foodId: "makhana", fragments: ["makhana"] },
  { foodId: "peanuts-raw", fragments: ["rawpeanut"] },
  { foodId: "sprouts-moong", fragments: ["sprouts"] },
  // Aromatics and spices. Lemongrass before lemon, and coriander leaves before the powder,
  // so the more specific name always wins.
  { foodId: "lemongrass", fragments: ["lemongrass"] },
  { foodId: "lemon", fragments: ["lemon"] },
  { foodId: "ginger", fragments: ["ginger"] },
  { foodId: "coriander-powder", fragments: ["corianderpowder"] },
  { foodId: "coriander-leaves", fragments: ["corianderleaves"] },
  { foodId: "mint-leaves", fragments: ["mintleaves"] },
  { foodId: "chilli-powder", fragments: ["chillipowder"] },
  { foodId: "chilli-powder", fragments: ["redchilli"] },
  { foodId: "cumin-seed", fragments: ["jeerapowder"] },
  { foodId: "cumin-seed", fragments: ["jeerawhole"] },
  { foodId: "tea-brewed", fragments: ["leaftea"] },
  { foodId: "tamarind-pulp", fragments: ["tamarind"] },
  { foodId: "rice-flour", fragments: ["riceflour"] },
  { foodId: "corn-starch", fragments: ["cornstarch"] },
  { foodId: "kala-chana-dry", fragments: ["kala", "chana"] },
  // "Sugar" appears in "no added sugar" and "zero sugar" all over the catalogue, so the
  // brand must be present too.
  { foodId: "sugar-white", fragments: ["parrys", "sugar"] },
];

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Separator-free form, so "good life" and "goodlife" compare equal. */
function compacted(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function containsWholeTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(value);
}

function numberFromUnknown(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) && result > 0 ? result : 1;
}

function storeFor(order: CardIqOrder): CardIqFoodItem["store"] | null {
  const merchant = normalized(order.merchant_name ?? "");
  if (merchant.includes("instamart")) return "Instamart";
  if (order.source === "bigbasket" || merchant.includes("bigbasket") || merchant.includes("bbnow")) return "BigBasket";
  if (order.source === "amazon" || merchant.includes("amazon")) return "Amazon";
  return null;
}

const amazonFoodTerms = [
  "milk", "yogurt", "yoghurt", "curd", "dahi", "skyr", "paneer", "tofu", "cheese", "butter",
  "ghee", "cream", "whey", "protein", "bread", "oat", "oats", "rice", "dal", "chana", "rajma",
  "besan", "atta", "flour", "poha", "vermicelli", "noodle", "noodles", "pasta", "peanut",
  "peanuts", "makhana", "almond", "almonds", "cashew", "nuts", "seeds", "fruit", "vegetable",
  "carrot", "potato", "gourd", "onion", "tomato", "capsicum", "spinach", "cucumber",
  "broccoli", "pumpkin", "banana", "avocado", "mango", "lemon", "ginger", "coriander",
  "lettuce", "beetroot", "brinjal", "sprout", "sprouts", "egg", "eggs", "chicken", "mutton",
  "fish", "prawn", "sugar", "jaggery", "sweetener", "salt", "tea", "coffee", "cocoa",
  "chocolate", "cookie", "cookies", "biscuit", "snack", "namkeen", "popcorn", "chips",
  "soda", "cola", "kombucha", "juice", "drink", "beverage", "shake", "water", "chilli",
  "masala", "tamarind", "oil", "pickle", "sauce", "jam", "honey", "murukku", "mixture",
  "electrolyte", "formula",
];

export function isNonFood(name: string) {
  const value = normalized(name);
  if (!value) return true;
  if (nonFoodBrands.some((brand) => containsWholeTerm(value, brand))) return true;
  return nonFoodTerms.some((term) => containsWholeTerm(value, term));
}

export function isFoodLike(name: string, store: CardIqFoodItem["store"]) {
  const value = normalized(name);
  if (!value) return false;
  if (isNonFood(name)) return false;
  // Grocery-only retailers are trusted for the remainder; Amazon sells everything, so a
  // positive food signal is still required there.
  if (store === "Instamart" || store === "BigBasket") return true;
  // Inclusion is deliberately lenient (substring, not whole word) so compound names like
  // "cornflour" and "Sauces" still register as food. Precision is not needed here because
  // non-food has already been excluded, and being listed in Purchases assigns no nutrition.
  // Whole-word matching is reserved for the decisions that do assign macros.
  return amazonFoodTerms.some((term) => value.includes(term));
}

/**
 * A processed-form word only disqualifies a raw-ingredient match when it is not part of
 * the matched term itself. "Peanut butter" legitimately contains "butter"; "banana oat
 * cookies" does not legitimately contain "cookies" as part of "banana".
 */
function hasForeignProcessedForm(value: string, matchedTerm: string) {
  return processedFormTerms.some((form) => containsWholeTerm(value, form) && !containsWholeTerm(matchedTerm, form));
}

/**
 * Words that turn a staple into a different product: a snack, dessert, drink, or spice
 * blend. Dairy cream is food, but "ice cream" is not dairy cream; potato is food, but
 * "potato chips" is not potato; dal is food, but "dal makhani masala" is a spice mix.
 *
 * This is narrower than processedFormTerms because category staples legitimately carry
 * words like "bread", "flour", "atta" and "cream" in their own names.
 */
const categoryConflictTerms = [
  "cookie", "cookies", "biscuit", "biscuits", "cracker", "crackers", "rusk", "chips",
  "crisps", "namkeen", "popcorn", "nachos", "murukku", "mixture", "laddoo", "sev",
  "cake", "brownie", "pastry", "muffin", "ice cream", "icecream", "candy", "toffee",
  "shake", "milkshake", "smoothie", "juice", "soda", "cola", "kombucha", "bar",
  "flavour", "flavoured", "flavor", "flavored", "dip", "sauce", "pickle", "jam",
  "syrup", "masala", "seasoning", "nuggets", "fries", "sticks", "batter", "premix",
  "beverage", "drink", "fizz", "yogurt", "yoghurt", "skyr",
];

function hasCategoryConflict(value: string) {
  return categoryConflictTerms.some((term) => containsWholeTerm(value, term));
}

export function matchCardIqFood(name: string): Pick<CardIqFoodItem, "matchedFoodId" | "matchKind"> {
  if (isNonFood(name)) return {};

  const compact = compacted(name);
  for (const product of exactProducts) {
    if (product.fragments.every((fragment) => compact.includes(fragment))) {
      return { matchedFoodId: product.foodId, matchKind: "Exact product" };
    }
  }

  const value = normalized(name);
  if (!hasCategoryConflict(value)) {
    for (const product of categoryProducts) {
      if (product.fragments.every((fragment) => compact.includes(fragment))) {
        return { matchedFoodId: product.foodId, matchKind: "Reference ingredient" };
      }
    }
  }

  // A manufactured product never inherits raw-ingredient nutrition. Better to show
  // "needs label" than to log a cookie as a banana.
  for (const [matchedFoodId, terms] of referenceMatches) {
    const matchedTerm = terms.find((term) => containsWholeTerm(value, term));
    if (!matchedTerm) continue;
    if (hasForeignProcessedForm(value, matchedTerm)) return {};
    return { matchedFoodId, matchKind: "Reference ingredient" };
  }
  return {};
}

export function makeCardIqFoodImport(orders: CardIqOrder[], generatedAt: string, windowStart: string): CardIqFoodImport {
  const grouped = new Map<string, CardIqFoodItem>();
  let orderCount = 0;
  for (const order of orders) {
    const store = storeFor(order);
    if (!store || !Array.isArray(order.items)) continue;
    orderCount += 1;
    for (const item of order.items) {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!isFoodLike(name, store)) continue;
      const key = `${store}:${normalized(name)}`;
      const previous = grouped.get(key);
      const latest = previous ? (previous.lastOrdered > order.order_at ? previous.lastOrdered : order.order_at) : order.order_at;
      grouped.set(key, {
        name,
        store,
        orderCount: (previous?.orderCount ?? 0) + 1,
        units: (previous?.units ?? 0) + numberFromUnknown(item.qty),
        lastOrdered: latest.slice(0, 10),
        ...matchCardIqFood(name),
      });
    }
  }
  return {
    schemaVersion: 1,
    generatedAt,
    windowStart,
    orderCount,
    items: [...grouped.values()].sort((a, b) => b.lastOrdered.localeCompare(a.lastOrdered) || b.orderCount - a.orderCount || a.name.localeCompare(b.name)),
  };
}

/**
 * Re-applies classification and matching to a stored snapshot.
 *
 * Matching lives in the app rather than in the saved file so that improving the matcher
 * immediately improves what KP sees, with no cardIQ re-import. The snapshot stays a record
 * of what was purchased; this function decides what it means.
 */
export function refineCardIqImport(snapshot: CardIqFoodImport): CardIqFoodImport {
  const items = snapshot.items
    .filter((item) => isFoodLike(item.name, item.store))
    .map((item) => {
      const { matchedFoodId, matchKind } = matchCardIqFood(item.name);
      const refined: CardIqFoodItem = { name: item.name, store: item.store, orderCount: item.orderCount, units: item.units, lastOrdered: item.lastOrdered };
      if (matchedFoodId) {
        refined.matchedFoodId = matchedFoodId;
        refined.matchKind = matchKind;
      }
      return refined;
    });
  return { ...snapshot, items };
}

/** Every food id the matcher can return. Used to prove none of them dangle. */
export function matchableFoodIds(): string[] {
  return [...new Set([...exactProducts, ...categoryProducts].map((entry) => entry.foodId), ...referenceMatches.map(([id]) => id))];
}

export function isCardIqFoodImport(value: unknown): value is CardIqFoodImport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CardIqFoodImport>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.items) && typeof candidate.generatedAt === "string" && typeof candidate.windowStart === "string";
}
