import assert from "node:assert/strict";
import test from "node:test";
import { isFoodLike, isNonFood, makeCardIqFoodImport, matchableFoodIds, matchCardIqFood, refineCardIqImport, type CardIqFoodImport } from "../app/cardiq-food";
import { nutritionItems } from "../app/nutrition-data";

const idFor = (name: string) => matchCardIqFood(name).matchedFoodId;

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
  // A different Nandini milk must NOT borrow the GoodLife pack's label. It may still
  // resolve to the toned-milk grade, but only as a weaker Reference match.
  const otherNandini = matchCardIqFood("Nandini Pasteurised Toned Milk, 500ml Pack");
  assert.notEqual(otherNandini.matchedFoodId, "nandini-goodlife-toned", "another pack must not inherit the GoodLife label");
  assert.equal(otherNandini.matchKind, "Reference ingredient", "a grade match is never presented as an exact product");
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

test("every food id the matcher can return actually exists", () => {
  const dangling = matchableFoodIds().filter((id) => !nutritionItems.some((food) => food.id === id));
  assert.deepEqual(dangling, [], "a matcher entry points at a food that is not in the catalogue");
});

test("milk grades resolve to the right grade, not just to milk", () => {
  assert.equal(idFor("Amul Taaza Homogenised Toned Milk 1 L Carton"), "milk-toned");
  assert.equal(idFor("Nandini Pasteurised Toned Milk, 500ml Pack"), "milk-toned");
  assert.equal(idFor("Milky Mist UHT Lactose Free Tonned Milk"), "milk-toned", "the retailer's 'Tonned' spelling still resolves");
  assert.equal(idFor("Amul Slim 'N' Trim Skimmed Milk, 1 Litre"), "milk-skimmed");
  assert.equal(idFor("Sid's Farm Skim Milk,500ml"), "milk-skimmed");
  assert.equal(idFor("Sids Farm Cow Milk 500 ml"), "milk-cow-whole");
  assert.equal(idFor("Akshayakalpa Organic Amrutha A2 Farm Fresh Organic Cow Milk 500 ml"), "milk-cow-whole");
  // Skimmed milk is 36 kcal and full cream is 88; collapsing them would be a 2.4x error.
  assert.notEqual(idFor("Amul Slim 'N' Trim Skimmed Milk"), idFor("Amul Taaza Toned Milk"));
});

test("a fragment must not match inside a longer word", () => {
  // "cream" appears inside "creamy", "creamer" and "cream onion"; none of them is cream.
  assert.equal(idFor("Milky Mist Greek Yogurt | 100% Natural | Low Fat | Creamy"), undefined);
  assert.equal(idFor("Peping Strawberry Cream Prebiotic Fizz"), undefined);
  assert.equal(idFor("Unibic SNAPPERS P C CREAM ONION 24 X 280 G"), undefined);
  // Real cream still resolves.
  assert.equal(idFor("D'lecta Dairy Cream"), "dairy-cream");
  assert.equal(idFor("Milky Mist Uht Cream"), "dairy-cream");
});

test("retail packs of pulses resolve to dry, not cooked", () => {
  // A 500 g pack of dal is dry. Cooked moong is 105 kcal/100g and dry is 348; using the
  // cooked figure for a dry pack understates it more than threefold.
  assert.equal(idFor("Tata Sampann Unpolished Moong Dal (Split), 500gm"), "moong-dal-dry");
  assert.equal(idFor("Organic Tattva Moong Dal 500 gm | Organic Green Sabut Moong Dal"), "moong-dal-dry");
  const dry = nutritionItems.find((food) => food.id === "moong-dal-dry");
  const cooked = nutritionItems.find((food) => food.id === "moong-dal-cooked");
  assert.ok(dry && cooked && dry.calories > cooked.calories * 3, "dry and cooked must stay distinct foods");
});

test("KP's chapati flour and staple dairy resolve", () => {
  assert.equal(idFor("organic tattva Whole Wheat Flour Chakki Atta"), "atta-whole-wheat");
  assert.equal(idFor("Nandini Curd - 500g Pouch"), "curd-dahi");
  assert.equal(idFor("Heritage Fresh Paneer - 200g"), "paneer-whole-milk");
  assert.equal(idFor("Amul Cheese Block, 200 g"), "cheese-processed");
  // "Soya paneer / bean curd" describes tofu, not dairy paneer or dairy curd.
  assert.equal(idFor("Soyarich - Tofu Premium - 200gm l Plant Based/Soya Paneer/Bean Curd/Vegan Paneer"), "tofu");
});

test("a staple word inside a snack or spice blend does not carry the staple's nutrition", () => {
  assert.equal(idFor("Lay's (India's Magic Masala) Crunchy Potato Chips"), undefined);
  assert.equal(idFor("Catch Dal Makhani Masala, 100g"), undefined);
  assert.equal(idFor("Get-A-Way Chocolate Brownie Fudge Ice Cream Tub"), undefined);
  assert.equal(idFor("Theobroma cheese crackers (No Preservatives , No Palm Oil)"), undefined);
  assert.equal(idFor("ACT II Ready To Eat Popcorn | Sour Cream & Cheese Flavour"), undefined);
  // The plain staples still resolve.
  assert.equal(idFor("Fresh Potato, 1kg"), "potato");
  assert.equal(idFor("Amul Cheese Cubes"), "cheese-processed");
});

test("sweet potato is not filed as potato", () => {
  // Amazon writes it as "Potato - Sweet", which a plain "potato" rule would swallow.
  assert.equal(idFor("Fresh Potato - Sweet, 500 g"), "sweet-potato");
  assert.equal(idFor("Sweet Potato (Sihi Genasu)"), "sweet-potato");
  assert.equal(idFor("Fresh Potato, 1kg"), "potato");
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
