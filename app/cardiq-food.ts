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

const nonFoodTerms = ["diaper", "shampoo", "detergent", "toilet paper", "tissue", "garbage bag", "gift card", "fastag", "mobile bill", "book", "towel", "hanger", "glass", "pitcher", "spray", "handwash", "cleaning", "kitchen cloth", "mosquito", "car", "charger"];
const foodTerms = ["milk", "yogurt", "yoghurt", "curd", "paneer", "cheese", "whey", "protein", "bread", "oat", "rice", "dal", "chana", "rajma", "besan", "peanut", "makhana", "fruit", "vegetable", "carrot", "potato", "gourd", "onion", "tomato", "capsicum", "spinach", "cucumber", "broccoli", "pumpkin", "banana", "avocado", "mango", "lemon", "egg", "sugar", "tea", "coffee", "cocoa", "cookie", "biscuit", "snack", "noodle", "popcorn", "soda", "cola", "kombucha", "juice", "drink", "beverage", "chilli", "coriander", "ginger", "tamarind", "oil", "ghee", "flour", "poha", "vermicelli", "lettuce", "sprout"];

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsWholeTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
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

export function isFoodLike(name: string, store: CardIqFoodItem["store"]) {
  const value = normalized(name);
  if (!value || nonFoodTerms.some((term) => containsWholeTerm(value, term))) return false;
  return store === "Instamart" || store === "BigBasket" || foodTerms.some((term) => value.includes(term));
}

export function matchCardIqFood(name: string): Pick<CardIqFoodItem, "matchedFoodId" | "matchKind"> {
  const value = normalized(name);
  const referenceMatches: Array<[string, string[]]> = [
    ["banana", ["banana"]], ["carrot", ["carrot"]], ["sweet-potato", ["sweet potato"]], ["cucumber", ["cucumber"]],
    ["tomato", ["tomato"]], ["capsicum", ["capsicum", "bell pepper"]], ["spinach", ["spinach"]], ["onion", ["onion"]],
    ["bottle-gourd", ["bottle gourd", "doodhi", "sorekaayi"]], ["broccoli", ["broccoli"]], ["pumpkin", ["pumpkin"]],
    ["whole-egg", ["white eggs", "eggs pack"]], ["oats", ["oat"]], ["chia", ["chia"]], ["peanut-butter", ["peanut butter"]],
  ];
  if (value.includes("nandini goodlife")) return { matchedFoodId: "nandini-goodlife-toned", matchKind: "Exact product" };
  for (const [matchedFoodId, terms] of referenceMatches) {
    if (terms.some((term) => value.includes(term))) return { matchedFoodId, matchKind: "Reference ingredient" };
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

export function isCardIqFoodImport(value: unknown): value is CardIqFoodImport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CardIqFoodImport>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.items) && typeof candidate.generatedAt === "string" && typeof candidate.windowStart === "string";
}
