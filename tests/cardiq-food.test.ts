import assert from "node:assert/strict";
import test from "node:test";
import { isFoodLike, isNonFood, makeCardIqFoodImport, matchCardIqFood, refineCardIqImport, type CardIqFoodImport } from "../app/cardiq-food";

test("cardIQ food import keeps real grocery products and excludes obvious non-food purchases", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-20T10:00:00Z", items: [{ name: "Nandini GoodLife Toned Milk, 1 L", qty: 2 }, { name: "Pampers baby diapers", qty: 1 }] },
    { source: "generic", merchant_name: "Instamart", order_at: "2026-07-21T10:00:00Z", items: [{ name: "Carrot", qty: "3" }, { name: "Himalaya protein shampoo", qty: 1 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");

  assert.equal(snapshot.orderCount, 2);
  assert.deepEqual(snapshot.items.map((item) => item.name), ["Carrot", "Nandini GoodLife Toned Milk, 1 L"]);
  assert.deepEqual(matchCardIqFood("Nandini GoodLife Toned Milk"), { matchedFoodId: "nandini-goodlife-toned", matchKind: "Exact product" });
  assert.deepEqual(matchCardIqFood("Fresh Carrot 500g"), { matchedFoodId: "carrot", matchKind: "Reference ingredient" });
  assert.equal(isFoodLike("Pampers baby diapers", "Amazon"), false);
  assert.equal(isFoodLike("Fresh Bottle Gourd", "Amazon"), true);
});

test("cardIQ import groups repeat purchases and preserves the latest order date", () => {
  const snapshot = makeCardIqFoodImport([
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-06-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 1 }] },
    { source: "amazon", merchant_name: "Amazon", order_at: "2026-07-01T10:00:00Z", items: [{ name: "Fresh Carrot 500g", qty: 2 }] },
  ], "2026-08-09T12:00:00Z", "2025-08-09");
  assert.deepEqual(snapshot.items[0], { name: "Fresh Carrot 500g", store: "Amazon", orderCount: 2, units: 3, lastOrdered: "2026-07-01", matchedFoodId: "carrot", matchKind: "Reference ingredient" });
});

/**
 * Every case below is a real purchase from KP's own cardIQ history that the previous
 * substring matcher assigned food nutrition to. Each one would have logged a wrong
 * calorie and macro figure with a single tap.
 */
test("non-food purchases never receive food nutrition", () => {
  const nonFood = [
    "Chicco Toothpaste for Kids, Best for Baby (6m-6y), Apple-Banana Flavour, 50g",
    "Benadryl Cough Formula Syrup For Sore Throat, Dry & Wet Cough Relief",
    "Aveeno Baby Soothing Relief Moisture Cream 227g|24-Hour Protection for Dry,Itchy Skin",
    "Harpic Power Plus Stain Removal Disinfectant Toilet Cleaner (Original)",
    "Dettol Antiseptic Liquid - For First Aid, Floor & Other Surface Cleaner",
    "Vim Floor Cleaner UltraPro Lemongrass & Sea Salt (1 ltr)",
    "Mangaldeep 3 in 1 Agarbatti",
    "mCaffeine Coffee Body Wash Combo Value Pack with Berries & Cocoa Shower Gels",
    "RIXTEC Lice Comb For Women And Kids Stainless Steel",
    "Clarkia 1X1 Meter Cotton Muslin Cloth For Kitchen Or Cheese Cloth Strainer",
    "Amazon Brand - Presto! Dishwash Gel Refill Pouch | Lemon | 2 Litre",
    "The Teacher: From the Sunday Times Bestselling Author of The Housemaid",
  ];
  for (const name of nonFood) {
    assert.equal(isNonFood(name), true, `should be classified non-food: ${name}`);
    assert.deepEqual(matchCardIqFood(name), {}, `must not get nutrition: ${name}`);
    // The grocery-only stores previously bypassed the non-food check entirely.
    assert.equal(isFoodLike(name, "Instamart"), false, `Instamart must not pass: ${name}`);
    assert.equal(isFoodLike(name, "Amazon"), false, `Amazon must not pass: ${name}`);
  }
});

test("word boundaries stop flavour and substring collisions", () => {
  // "sore thrOAT" and "OATmeal" both contain "oat" as a substring but not as a word.
  assert.deepEqual(matchCardIqFood("Syrup For Sore Throat Relief"), {});
  assert.deepEqual(matchCardIqFood("Colloidal Oatmeal Skin Balm"), {});
  // A flavour name is not the ingredient.
  assert.deepEqual(matchCardIqFood("Toothpaste Apple-Banana Flavour"), {});
});

test("manufactured products never inherit raw-ingredient nutrition", () => {
  const processed: Array<[string, string]> = [
    ["Slurrp Farm No Maida No Refined Sugar Banana Oat Cookies", "a cookie is not a banana"],
    ["So Good Plant Based Oat Beverage Unsweetened 200ml", "oat drink is not dry rolled oats"],
    ["So Good Oat Barista Edition Beverage 200ml", "oat drink is not dry rolled oats"],
    ["Only Earth Cold Coffee Oats Shake", "an oat shake is not dry rolled oats"],
    ["Unibic SNAPPERS P C CREAM ONION 24 X 280 G", "a fried snack is not a raw onion"],
    ["Lay's (India's Magic Masala) Crunchy Potato Chips", "crisps are not potatoes"],
  ];
  for (const [name, why] of processed) {
    assert.deepEqual(matchCardIqFood(name), {}, `${why}: ${name}`);
  }
});

test("a processed word belonging to the matched term does not block the match", () => {
  // "peanut butter" contains "butter", which is a processed-form word. The guard must
  // only fire on processed words that are foreign to the matched term.
  assert.deepEqual(matchCardIqFood("Pintola All Natural Peanut Butter 1kg"), { matchedFoodId: "peanut-butter", matchKind: "Reference ingredient" });
});

test("retailer spelling differences resolve to the same exact product", () => {
  // Instamart writes "GoodLife", Amazon writes "Good Life". Both are the same carton.
  const instamart = matchCardIqFood("Nandini GoodLife Toned Milk");
  const amazon = matchCardIqFood("Nandini Good Life Toned Milk, 1L,Liquid");
  assert.deepEqual(instamart, { matchedFoodId: "nandini-goodlife-toned", matchKind: "Exact product" });
  assert.deepEqual(amazon, instamart, "one space must not change the product identity");
  // A different Nandini milk must NOT borrow the GoodLife label.
  assert.deepEqual(matchCardIqFood("Nandini Pasteurised Toned Milk, 500ml Pack"), {});
});

test("raw produce still matches across English and Kannada retailer names", () => {
  const produce: Array<[string, string]> = [
    ["Fresh Banana Yelakki, Ripened, 500 g", "banana"],
    ["Bottle Gourd (Sorekaayi)", "bottle-gourd"],
    ["Sweet Potato (Sihi Genasu)", "sweet-potato"],
    ["Green Cucumber (Hasiru Soutekaayi)", "cucumber"],
    ["Onion -Value Pack (Eerulli)", "onion"],
    ["nectr Broccoli (Chemical Free)", "broccoli"],
    ["Fresh White Eggs 30 Piece", "whole-egg"],
  ];
  for (const [name, expected] of produce) {
    assert.deepEqual(matchCardIqFood(name), { matchedFoodId: expected, matchKind: "Reference ingredient" }, name);
  }
});

test("refining a stored snapshot drops non-food and re-matches without a re-import", () => {
  const stored = {
    schemaVersion: 1,
    generatedAt: "2026-08-09T12:00:00Z",
    windowStart: "2025-08-09",
    orderCount: 3,
    items: [
      { name: "Chicco Toothpaste for Kids, Apple-Banana Flavour", store: "Amazon", orderCount: 1, units: 1, lastOrdered: "2026-07-01", matchedFoodId: "banana", matchKind: "Reference ingredient" },
      { name: "Nandini Good Life Toned Milk, 1L,Liquid", store: "Amazon", orderCount: 2, units: 2, lastOrdered: "2026-07-02" },
      { name: "Fresh Carrot - Orange, 500g Pack", store: "Amazon", orderCount: 8, units: 8, lastOrdered: "2026-07-03" },
    ],
  } as CardIqFoodImport;

  const refined = refineCardIqImport(stored);
  assert.deepEqual(refined.items.map((item) => item.name), ["Nandini Good Life Toned Milk, 1L,Liquid", "Fresh Carrot - Orange, 500g Pack"], "toothpaste must be dropped");
  assert.equal(refined.items[0].matchedFoodId, "nandini-goodlife-toned", "an unmatched purchase gains its match");
  assert.equal(refined.items[0].matchKind, "Exact product");
  assert.equal(refined.items[1].matchedFoodId, "carrot");
  assert.equal(refined.orderCount, 3, "purchase facts are preserved");
  assert.equal(refined.items[1].orderCount, 8, "order counts are preserved");
});

test("failure injection: a stale wrong match in a stored snapshot is corrected, not trusted", () => {
  const poisoned = {
    schemaVersion: 1,
    generatedAt: "2026-08-09T12:00:00Z",
    windowStart: "2025-08-09",
    orderCount: 1,
    items: [{ name: "Benadryl Cough Formula Syrup For Sore Throat", store: "Instamart", orderCount: 1, units: 1, lastOrdered: "2026-07-01", matchedFoodId: "oats", matchKind: "Reference ingredient" }],
  } as CardIqFoodImport;
  assert.equal(refineCardIqImport(poisoned).items.length, 0, "a saved wrong match must not survive refinement");
});
