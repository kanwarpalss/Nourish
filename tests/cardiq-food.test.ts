import assert from "node:assert/strict";
import test from "node:test";
import { isCardIqFoodImport, isFoodLike, makeCardIqFoodImport, matchCardIqFood, sanitizeCardIqFoodImport } from "../app/cardiq-food";

test("cardIQ food import keeps real grocery products and excludes obvious non-food purchases", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-20T10:00:00Z", items: [{ name: "Nandini Good Life Toned Milk, 1L,Liquid", qty: 2 }, { name: "Pampers baby diapers", qty: 1 }] },
    { source: "generic", merchant_name: "Instamart", order_at: "2026-07-21T10:00:00Z", items: [{ name: "Carrot", qty: "3" }, { name: "Himalaya protein shampoo", qty: 1 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");

  assert.equal(snapshot.orderCount, 2);
  assert.deepEqual(snapshot.items.map((item) => item.name), ["Carrot", "Nandini Good Life Toned Milk, 1L,Liquid"]);
  assert.deepEqual(matchCardIqFood("Nandini GoodLife Toned Milk"), {}, "missing pack variant must not inherit the 1 L product");
  assert.deepEqual(matchCardIqFood("Nandini Good Life Toned Milk, 1L,Liquid"), { matchedFoodId: "nandini-goodlife-toned", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Fresh Carrot 500g"), {}, "generic references stay searchable but never auto-populate a purchase");
  assert.equal(isFoodLike("Pampers baby diapers", "Amazon"), false);
  assert.equal(isFoodLike("Fresh Bottle Gourd", "Amazon"), true);
  assert.equal(isFoodLike("दूध", "BigBasket"), true);
});

test("product matching refuses flavour words and stale matches that point at a different food", () => {
  for (const name of [
    "So Good Oat Barista Edition Beverage 200ml",
    "Chicco Toothpaste Apple-Banana Flavour",
    "Unibic Snappers Cream Onion",
    "Aveeno Baby Moisture Cream with oat extract",
    "Benadryl Cough Formula Syrup",
    "Slurrp Farm Banana Oat Cookies",
  ]) assert.deepEqual(matchCardIqFood(name), {}, name);

  const sanitized = sanitizeCardIqFoodImport({
    schemaVersion: 1,
    generatedAt: "2026-08-09T12:00:00Z",
    windowStart: "2025-08-09",
    orderCount: 1,
    items: [
      { name: "So Good Oat Barista Edition Beverage 200ml", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-20", matchedFoodId: "oats", matchKind: "Reference ingredient" },
      { name: "Chicco Toothpaste Apple-Banana Flavour", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-20", matchedFoodId: "banana", matchKind: "Reference ingredient" },
      { name: "Fresh Banana Yelakki, 500 g", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-20" },
    ],
  });
  assert.deepEqual(sanitized.items, [
    { name: "So Good Oat Barista Edition Beverage 200ml", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-20" },
    { name: "Fresh Banana Yelakki, 500 g", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-20" },
  ]);
});

test("only exact researched products receive packaged-food macros", () => {
  assert.deepEqual(matchCardIqFood("Amul Lactose Free Milk, 250 Ml"), { matchedFoodId: "amul-lactose-free", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Amul Lactose Free Milk"), {});
  assert.deepEqual(matchCardIqFood("Amul Lactose Free Milk, 1 L"), {});
  assert.deepEqual(matchCardIqFood("Nandini Paneer, 500 g"), {});
  assert.deepEqual(matchCardIqFood("Amul Diced Cheese Blend Mozzeralla Cheddar"), {});
  assert.deepEqual(matchCardIqFood("Coca-Cola, 750ml"), { matchedFoodId: "coca-cola-original", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Coca-Cola Zero Sugar, No Calories Soft Drink PET Bottle, 750ml"), {}, "an unrecorded title is not assumed to be the same SKU");
  assert.deepEqual(matchCardIqFood("Coca-Cola® ZeroTM Sugar, No Calories Soft Drink PET Bottle, 750ml"), { matchedFoodId: "coca-cola-zero", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Coke Zero Zero Cola Sugar, No Calories Soft Drink Pet Bottle, 250 Ml (Pack of 8)"), { matchedFoodId: "coca-cola-zero-250", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Coke Zero Zero Cola Sugar, No Calories Soft Drink Pet Bottle, 250 Ml"), {}, "the 250 ml bottle must not inherit the retailer pack-of-8 conversion");
  assert.deepEqual(matchCardIqFood("Fresh Onion Spring Fresh, 100g Pack"), {});
  assert.deepEqual(matchCardIqFood("Raw Pressery Coconut Water 200ml"), matchCardIqFood("Raw Pressery Coconut Water 200 ml"));
  assert.deepEqual(matchCardIqFood("Amul Cheese Block 200g"), matchCardIqFood("Amul Cheese Block 200 g"));
});

test("newly researched purchase titles match only their complete name and variant", () => {
  const exact: Array<[string, string]> = [
    ["Sid's Farm High Protein Milk - No added Whey. Made from Tested Milk (No Antibiotics No Hormones No Preservatives),250 ml", "sids-farm-high-protein-milk"],
    ["Weikfield Custard Powder 100g Pack Vanilla Flavor 2 Minute Preparation Makes Smooth Creamy Custard Contains Quality Ingredients Best for Fruit Salads Puddings", "weikfield-custard-powder"],
    ["The Health Factory Zero Maida Protein Bread 250g Clean Label Not Brown", "health-factory-protein-bread"],
    ["So Good Plant Based Oat Beverage Unsweetened 200ml Lactose Free No Added Sugar No Preservatives Zero Cholesterol Dairy Free Source of Calcium Vitamins", "so-good-oat-unsweetened"],
    ["Milky Mist Greek Yogurt 7 g Protein 100% Natural Low Fat Probiotic Rich Creamy Delicious 100g", "milkymist-greek-yogurt"],
  ];
  for (const [title, matchedFoodId] of exact) {
    assert.deepEqual(matchCardIqFood(title), { matchedFoodId, matchKind: "Exact product" }, title);
  }

  for (const nearMiss of [
    "Sid's Farm High Protein Milk",
    "Sid's Farm High Protein Milk 1L",
    "Weikfield Custard Powder Strawberry 100g",
    "The Health Factory Zero Maida Protein Bread 350g Clean Label Not Brown",
    "So Good Plant Based Oat Beverage Barista 200ml",
    "Milky Mist Greek Yogurt 700g",
  ]) assert.deepEqual(matchCardIqFood(nearMiss), {}, nearMiss);
});

test("collision words cannot override the exact variant or raw-food form", () => {
  assert.deepEqual(matchCardIqFood("Coca-Cola 750ml Zero Sugar Soft Drink"), {});
  assert.deepEqual(matchCardIqFood("Coca-Cola 750ml Diet Soft Drink"), {}, "the researched Diet Coke entry is specifically 300 ml");
  assert.deepEqual(matchCardIqFood("Nandini GoodLife Full Cream Milk"), {});
  assert.deepEqual(matchCardIqFood("Nandini GoodLife Skimmed Milk"), {});
  assert.deepEqual(matchCardIqFood("Nandini GoodLifeish Milk"), {});
  assert.deepEqual(matchCardIqFood("MyNandini GoodLife Milk"), {});
  for (const name of ["Fresh Tomato Ketchup", "Organic Yellow Pumpkin Seeds", "Fresh Onion Powder", "Bottle Gourd Hair Oil"]) {
    assert.deepEqual(matchCardIqFood(name), {}, name);
  }
  for (const name of ["Amul Lactose Free Milk Chocolate Bar", "Britannia Laughing Cow Cheese Slices Crackers", "Coca-Cola 750ml Bottle Opener"]) {
    assert.deepEqual(matchCardIqFood(name), {}, name);
  }
  for (const name of [
    "Amul Lactose Free Milk 1L with 250ml free",
    "Nandini Paneer 500g plus 200g free",
    "Combo Nandini Paneer 200g and Amul Cheese Block 200g",
    "Nandini GoodLife Toned Milk 1L and 500ml combo",
    "Raw Pressery Coconut Water Mango 200ml",
    "Nandini Paneer Masala 200g",
    "Coca Cola Zero Sugar 750ml pack of 8",
  ]) assert.deepEqual(matchCardIqFood(name), {}, name);
  for (const name of ["Fresh Carrot Face Wash", "Banana Conditioner", "Tomato Facial Scrub"]) {
    assert.equal(isFoodLike(name, "Amazon"), false, name);
  }
});

test("the snapshot guard rejects malformed item records before sanitizing", () => {
  const base = { schemaVersion: 1, generatedAt: "2026-08-09", windowStart: "2025-08-09", orderCount: 1 };
  assert.equal(isCardIqFoodImport({ ...base, items: [null] }), false);
  assert.equal(isCardIqFoodImport({ ...base, items: [{ name: "Milk", store: "Pharmacy" }] }), false);
  assert.equal(isCardIqFoodImport({ ...base, generatedAt: "", items: [] }), false);
  assert.equal(isCardIqFoodImport({ ...base, orderCount: Number.NaN, items: [] }), false);
});

test("cardIQ import groups repeat purchases and preserves the latest order date", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-06-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 1 }] },
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 2 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");
  assert.deepEqual(snapshot.items[0], { name: "Fresh Carrot 500g", store: "Amazon", orderCount: 2, units: 3, lastOrdered: "2026-07-01" });
});

test("cardIQ import respects its dates, combines duplicate lines, and caps numeric overflow", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2025-08-08T23:59:59Z", items: [{ name: "Fresh Carrot 500g", qty: 10 }] },
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: Number.MAX_VALUE }, { name: "Fresh Carrot 500g", qty: Number.MAX_VALUE }] },
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-08-09T12:00:01Z", items: [{ name: "Fresh Carrot 500g", qty: 10 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");
  assert.equal(snapshot.orderCount, 1);
  assert.equal(snapshot.items[0].orderCount, 1);
  assert.equal(snapshot.items[0].units, Number.MAX_SAFE_INTEGER);
});
