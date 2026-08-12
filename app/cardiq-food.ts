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

const nonFoodTerms = [
  "diaper", "shampoo", "detergent", "toilet paper", "tissue", "garbage bag", "gift card", "fastag", "mobile bill",
  "book", "towel", "hanger", "glass", "pitcher", "spray", "handwash", "cleaning", "kitchen cloth", "mosquito",
  "car", "charger", "toothpaste", "lice comb", "antiseptic", "toilet cleaner", "floor cleaner", "agarbatti", "muslin cloth",
  "dishwash", "body wash", "body washes", "shower gel", "healing balm", "skin protectant", "moisture cream", "cough formula", "cough syrup",
  "infant formula", "psychological thriller", "face wash", "conditioner", "facial scrub",
];
const foodTerms = ["milk", "yogurt", "yoghurt", "curd", "paneer", "cheese", "whey", "protein", "bread", "oat", "rice", "dal", "chana", "rajma", "besan", "peanut", "makhana", "fruit", "vegetable", "carrot", "potato", "gourd", "onion", "tomato", "capsicum", "spinach", "cucumber", "broccoli", "pumpkin", "banana", "avocado", "mango", "lemon", "egg", "sugar", "tea", "coffee", "cocoa", "cookie", "biscuit", "snack", "noodle", "popcorn", "soda", "cola", "kombucha", "juice", "drink", "beverage", "chilli", "coriander", "ginger", "tamarind", "oil", "ghee", "flour", "poha", "vermicelli", "lettuce", "sprout"];

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsWholeTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(value);
}

function numberFromUnknown(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) && result > 0 ? Math.min(result, Number.MAX_SAFE_INTEGER) : 1;
}

function isDateValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isPositiveFinite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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
  const compactUnits = value.replace(/(\d+)\s+(g|ml|l)\b/g, "$1$2");
  const exactMatches: Array<[string, string]> = [
    ["amul-lactose-free", "amul lactose free milk 250ml"],
    ["coca-cola-original", "coca cola 750ml"],
    ["nandini-paneer", "nandini paneer 200g pack"],
    ["coca-cola-zero", "coca cola zerotm sugar no calories soft drink pet bottle 750ml"],
    ["coca-cola-zero-250", "coke zero zero cola sugar no calories soft drink pet bottle 250ml pack of 8"],
    ["amul-processed-cheese-block", "amul cheese block 200g"],
    ["raw-pressery-coconut-water", "raw pressery coconut water 200ml"],
    ["yogabar-protein-shake-cold-coffee", "yogabar protein shake with 26g protein no added sugar pack of 1 250ml cold coffe"],
    ["epigamia-turbo-cookies-cream", "epigamia turbo 25g protein milkshake cookies cream 250ml"],
    ["akshayakalpa-amrutha-a2", "akshayakalpa organic amrutha a2 farm fresh organic cow milk 500ml"],
    ["nandini-goodlife-toned", "nandini good life toned milk 1l liquid"],
    ["kinley-soda", "kinley strong soda original 750ml"],
    ["diet-coke", "coca cola diet soft drink 300ml cola"],
  ];

  const exactMatch = exactMatches.find(([, retailerTitle]) => compactUnits === retailerTitle);
  if (exactMatch) return { matchedFoodId: exactMatch[0], matchKind: "Exact product" };
  return {};
}

export function sanitizeCardIqFoodImport(snapshot: CardIqFoodImport): CardIqFoodImport {
  return {
    ...snapshot,
    items: snapshot.items
      .filter((item) => item && typeof item.name === "string" && isFoodLike(item.name, item.store))
      .map((item) => {
        const purchase = { ...item };
        delete purchase.matchedFoodId;
        delete purchase.matchKind;
        return { ...purchase, ...matchCardIqFood(item.name) };
      }),
  };
}

export function makeCardIqFoodImport(orders: CardIqOrder[], generatedAt: string, windowStart: string): CardIqFoodImport {
  const grouped = new Map<string, CardIqFoodItem>();
  let orderCount = 0;
  const rangeStart = Date.parse(`${windowStart}T00:00:00Z`);
  const rangeEnd = Date.parse(generatedAt);
  for (const order of orders) {
    const store = storeFor(order);
    const orderedAt = Date.parse(order.order_at);
    if (!store || !Array.isArray(order.items) || !Number.isFinite(orderedAt) || !Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || orderedAt < rangeStart || orderedAt > rangeEnd) continue;
    orderCount += 1;
    const seenInOrder = new Set<string>();
    for (const item of order.items) {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!isFoodLike(name, store)) continue;
      const key = `${store}:${normalized(name)}`;
      const previous = grouped.get(key);
      const latest = previous ? (previous.lastOrdered > order.order_at ? previous.lastOrdered : order.order_at) : order.order_at;
      const firstLineInOrder = !seenInOrder.has(key);
      seenInOrder.add(key);
      grouped.set(key, {
        name,
        store,
        orderCount: (previous?.orderCount ?? 0) + (firstLineInOrder ? 1 : 0),
        units: Math.min(Number.MAX_SAFE_INTEGER, (previous?.units ?? 0) + numberFromUnknown(item.qty)),
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
  return candidate.schemaVersion === 1
    && Array.isArray(candidate.items)
    && candidate.items.length <= 10_000
    && candidate.items.every((item) => item !== null
      && typeof item === "object"
      && typeof item.name === "string"
      && item.name.trim().length > 0
      && item.name.length <= 1_000
      && ["Amazon", "BigBasket", "Instamart"].includes(item.store)
      && isPositiveFinite(item.orderCount)
      && isPositiveFinite(item.units)
      && isDateValue(item.lastOrdered))
    && isPositiveFinite(candidate.orderCount)
    && isDateValue(candidate.generatedAt)
    && isDateValue(candidate.windowStart);
}

/** Backwards-compatible name used by the diary UI. */
export const refineCardIqImport = sanitizeCardIqFoodImport;
