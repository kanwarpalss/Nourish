import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { exactCardIqMatches } from "../app/cardiq-food";
import { nutritionItems } from "../app/nutrition-data";
import { articles, filterExistingPhotoMap } from "../scripts/source-wikipedia-photos.mjs";

const byId = new Map(nutritionItems.map((food) => [food.id, food]));

test("catalogue identities, sources and quantities are structurally complete", () => {
  const ids = nutritionItems.map((food) => food.id);
  assert.equal(new Set(ids).size, ids.length, "catalogue ids must be unique");

  for (const food of nutritionItems) {
    assert.match(food.source.url, /^https:\/\//, `${food.id}: source must be an HTTPS page`);
    for (const field of ["amount", "calories", "protein", "carbs", "fat", "fiber"] as const) {
      assert.ok(Number.isFinite(food[field]) && food[field] >= 0, `${food.id}: ${field} must be finite and non-negative`);
    }
    if ((food.category === "Ordered" || food.category === "Product") && food.brand !== "Generic") {
      assert.ok(food.variant.trim(), `${food.id}: a branded product needs its exact variant or an explicit not-identified note`);
    }
    for (const conversion of food.conversions ?? []) {
      assert.ok(Number.isFinite(conversion.basisAmount) && conversion.basisAmount > 0, `${food.id}: ${conversion.unit} conversion must be positive`);
    }
    if (food.imageUrl?.startsWith("/food-images/")) {
      const path = fileURLToPath(new URL(`../public${food.imageUrl}`, import.meta.url));
      assert.ok(existsSync(path), `${food.id}: local image file is missing`);
    } else if (food.imageUrl) {
      assert.match(food.imageUrl, /^https:\/\//, `${food.id}: remote image must use HTTPS`);
    }
  }
});

test("every exact CardIQ title lands on a real, fully named catalogue variant", () => {
  const retailerTitles = exactCardIqMatches.map(([, title]) => title);
  assert.equal(new Set(retailerTitles).size, retailerTitles.length, "exact retailer titles must be unique");
  for (const [foodId] of exactCardIqMatches) {
    const food = byId.get(foodId);
    assert.ok(food, `${foodId}: exact purchase target is missing`);
    assert.ok(food.variant.trim(), `${foodId}: exact purchase target has no variant`);
  }
});

test("known cross-object photo corruptions and unsafe duplicate products cannot return", () => {
  const wrongFragments: Record<string, string[]> = {
    tomato: ["ars_cucumber"],
    onion: ["pepper"],
    broccoli: ["courge", "calabash"],
    oil: ["huevo_frito", "fried_egg"],
    almonds: ["skippy"],
    "greek-yogurt-nonfat": ["reis", "brown_rice"],
    tofu: ["panir", "paneer"],
    potato: ["sprout"],
    lettuce: ["solanum", "eggplant"],
    "coconut-water": ["murukku"],
    "rice-flour": ["tamarind"],
    "kurkure-masala-munch": ["kurkure_logo", "wordmark"],
  };
  for (const [id, fragments] of Object.entries(wrongFragments)) {
    const image = byId.get(id)?.imageUrl?.toLowerCase() ?? "";
    for (const fragment of fragments) assert.ok(!image.includes(fragment), `${id}: inherited wrong photo fragment ${fragment}`);
  }
  for (const removed of ["cola-zero-sugar", "cola-classic", "kinley-strong-soda", "epigamia-turbo-shake", "monk-fruit-sweetener"]) {
    assert.equal(byId.has(removed), false, `${removed}: ambiguous or duplicate record must stay removed`);
  }
});

test("high-risk corrected packs retain their exact size and disclosure state", () => {
  const chana = byId.get("24-mantra-kabuli-chana")!;
  assert.equal(chana.variant, "908 g (2 lb) pouch");
  assert.equal(chana.conversions?.find((item) => item.unit === "pack")?.basisAmount, 908);

  const bambino = byId.get("bambino-vermicelli")!;
  assert.equal(bambino.variant, "Plain · 450 g pack · dry");
  assert.equal(bambino.fiberDeclared, false, "an omitted panel field is unknown, not zero");

  assert.match(byId.get("sids-farm-high-protein-milk")?.imageUrl ?? "", /sidsfarm\.com/);
  assert.match(byId.get("milkymist-greek-yogurt")?.imageUrl ?? "", /890\/408\/330\/2292/);
  assert.match(byId.get("health-factory-protein-bread")?.imageUrl ?? "", /890\/800\/905\/9246/);
});

test("automatic Wikipedia sourcing excludes branded and state-sensitive foods", () => {
  const forbidden = [
    "coca-cola-original", "coca-cola-zero", "diet-coke", "parle-g", "maggi-masala-noodles",
    "chicken-breast", "chicken-curry-cut-raw", "whole-egg", "brown-rice", "rice-white-cooked",
    "moong-dal-cooked", "green-peas-cooked", "coriander-powder", "tamarind-pulp",
  ];
  for (const id of forbidden) assert.equal(Object.hasOwn(articles, id), false, `${id}: exact visual form cannot be inferred from an article lead image`);
  assert.deepEqual(filterExistingPhotoMap({
    cucumber: "https://images.test/cucumber.jpg",
    "coca-cola-zero": "https://images.test/coke.jpg",
    "monk-fruit-sweetener": "https://images.test/plant.jpg",
    tofu: "not-https",
  }), { cucumber: "https://images.test/cucumber.jpg" }, "a stale resume file cannot reintroduce retired, branded or malformed candidates");
});
