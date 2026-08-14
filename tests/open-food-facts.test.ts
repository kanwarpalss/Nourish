import assert from "node:assert/strict";
import test from "node:test";
import { buildQueries, rankCandidates, score, toCandidate, tokens } from "../scripts/audit-open-food-facts";

// Real Open Food Facts records, kept verbatim so these tests describe the
// actual data the lookup has to cope with.
const bambino = {
  code: "8901221010013",
  product_name: "Bambino Vermicelli",
  brands: "Bambino",
  quantity: "425g",
  nutrition_data_per: "100g",
  nutriments: { "energy-kcal_100g": 381, proteins_100g: 10.5, carbohydrates_100g: 82.5, fat_100g: 1, fiber_100g: 3 },
};
const parleG = {
  code: "8901719134845",
  product_name: "Parle-G Biscuit",
  brands: "Parle",
  quantity: "45gm",
  nutrition_data_per: "100g",
  nutriments: { "energy-kcal_100g": 454, proteins_100g: 6.9, carbohydrates_100g: 77.3, fat_100g: 13 },
};
/** Genuine listing whose "per 100 g" values actually describe a 200 g serving. */
const impossiblePoha = {
  code: "8904043902326",
  product_name: "Poha Flaked Rice",
  brands: "Tata Sampann",
  quantity: "1 kg",
  nutrition_data_per: "100g",
  nutriments: { "energy-kcal_100g": 722, proteins_100g: 12, carbohydrates_100g: 162.8, fat_100g: 2.6, fiber_100g: 15.2 },
};
const noMacros = {
  code: "0000000000001",
  product_name: "Bambino Baliyan Seviyan",
  brands: "Bambino",
  nutrition_data_per: "100g",
  nutriments: {},
};

test("a long product name is retried as progressively broader queries", () => {
  const queries = buildQueries("Bambino Long Cut Vermicelli 450 g pack India buy online fresh");
  assert.ok(queries.length >= 3, "one over-specified query is what caused false 'no label found'");
  assert.ok(queries[0].split(" ").length > queries.at(-1)!.split(" ").length, "queries must broaden, not narrow");
  assert.equal(queries.at(-1), "bambino", "the last resort is the brand or head noun alone");
  for (const query of queries) assert.ok(query.split(" ").length <= 5, `too specific: ${query}`);

  // Retail noise must not become search terms. Pack numbers stay available to
  // scoring (a "425g" match is real evidence) but are dropped from queries.
  assert.deepEqual(tokens("Buy Fresh Poha Online India 500 grams"), ["poha", "500"]);
  assert.deepEqual(buildQueries("Buy Fresh Poha Online India 500 grams"), ["poha"]);
  assert.deepEqual(buildQueries(""), [], "an empty name yields no queries rather than a blind search");
  assert.deepEqual(buildQueries("!!! ---"), []);
  assert.deepEqual(buildQueries("500 1kg"), [], "a name with nothing but numbers must not trigger a blind search");
});

test("a label is only accepted when energy and all three macros are present", () => {
  assert.ok(toCandidate("bambino vermicelli", bambino));
  assert.equal(toCandidate("bambino vermicelli", noMacros), null, "no macros means no usable label");

  // Fibre is routinely absent from an Indian pack and must not disqualify.
  const nutrimentsWithoutFibre: Record<string, number | string> = { ...bambino.nutriments };
  delete nutrimentsWithoutFibre.fiber_100g;
  const withoutFibre = { ...bambino, nutriments: nutrimentsWithoutFibre };
  const candidate = toCandidate("bambino vermicelli", withoutFibre);
  assert.ok(candidate, "a missing fibre value must not reject an otherwise complete label");
  assert.equal(candidate.fiber, null, "and it is reported as unknown, not as zero");
});

test("a listing whose macros cannot fit in 100 g is rejected instead of doubling every meal", () => {
  assert.equal(toCandidate("poha", impossiblePoha), null, "162.8 g of carbohydrate cannot fit in 100 g");
  assert.equal(toCandidate("oil", { ...bambino, nutriments: { ...bambino.nutriments, "energy-kcal_100g": 901 } }), null);

  // Failure injection: without the basis check this record sails through.
  const unchecked = impossiblePoha.nutriments;
  assert.ok(unchecked.proteins_100g + unchecked.carbohydrates_100g + unchecked.fat_100g > 100);
  const fromMacros = unchecked.proteins_100g * 4 + unchecked.carbohydrates_100g * 4 + unchecked.fat_100g * 9;
  assert.ok(
    Math.abs(fromMacros - unchecked["energy-kcal_100g"]) <= 1,
    "the bad record is internally consistent, so only the 100 g basis check catches it",
  );
});

test("ranking prefers the product actually asked for over an unrelated best-seller", () => {
  const ranked = rankCandidates("bambino vermicelli", [parleG, bambino, impossiblePoha]);
  assert.equal(ranked[0].brands, "Bambino", "the requested brand must outrank a popular unrelated product");
  assert.ok(ranked.every((candidate) => candidate.code !== impossiblePoha.code), "invalid records never reach the report");
  assert.ok(score("bambino vermicelli", bambino) > score("bambino vermicelli", parleG));

  // The old endpoint returned the same generic page for every query, so every
  // food scored against products like this one and was written off.
  assert.ok(score("poha thick 500g", parleG) < 55, "an unrelated product must not reach the confident threshold");
});
