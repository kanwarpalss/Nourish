# Nutrition and image evidence

> **Scope:** Nourish is a personal reference catalogue, not a medical device. An exact product record means the brand, product, flavour/form, and pack variant were identified. If any of those are uncertain, the cardIQ purchase remains unlinked.

## Source hierarchy

1. **Official label** — the manufacturer’s current panel for the exact variant.
2. **Label mirror** — a barcode-backed label photo or exact retailer panel; useful, but weaker than the pack in hand.
3. **Reference** — IFCT/USDA composition for an explicitly named raw/cooked food or category. Never auto-attached to a branded purchase.
4. **Estimated / Personal** — KP’s correction or a transparent calculated assembly.

Primary references:

- [ICMR–National Institute of Nutrition Indian Food Composition Tables 2017](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf)
- [USDA FoodData Central](https://fdc.nal.usda.gov/)
- [FSSAI dairy standards](https://fssai.gov.in/upload/uploadfiles/files/Chapter%202_1%20%28Dairy%20products%20and%20analogues%29.pdf)
- [Open Food Facts](https://world.openfoodfacts.org/) for barcode-backed label mirrors

FSSAI’s toned/full-cream/double-toned definitions establish fat and solids-not-fat grades; they do **not** establish one universal calorie, protein, or carbohydrate panel for every brand. Those catalogue entries are therefore category references, say that the pack may differ, and are never exact purchase matches.

## Exact purchase-title coverage

The local cardIQ snapshot contains 193 food rows. Eighteen complete retailer titles currently auto-link; 175 remain disabled in [UNMATCHED_CARDIQ_FOODS.md](./UNMATCHED_CARDIQ_FOODS.md).

Five links were added in the 2026-08-21 audit only after the complete title and pack variant matched:

| Purchase | Exact catalogue record | Nutrition evidence |
|---|---|---|
| Sid’s Farm High Protein Milk, 250 ml | Fat-free, lactose-free 250 ml can | [Sid’s Farm official page](https://sidsfarm.com/products/high-protein-milk) |
| Weikfield Custard Powder, Vanilla, 100 g | Vanilla 100 g dry powder | Manufacturer identity plus published dry-panel mirror |
| The Health Factory Zero Maida Protein Bread, 250 g | 250 g loaf | Manufacturer identity plus barcode-backed panel |
| So Good Oat Beverage Unsweetened, 200 ml | Unsweetened Creamy 200 ml carton | Exact retailer panel mirror |
| Milky Mist Greek Yogurt, 100 g | Natural 100 g cup | Open Food Facts barcode 8904083302292 |

Near-misses remain unmatched: missing pack size, a different flavour, a multipack mismatch, 700 g versus 100 g yogurt, Barista versus Unsweetened oat drink, or a product-family name without its exact variant.

## Corrected high-risk records

- **24 Mantra Organic Kabuli Chana** is a **908 g / 2 lb pouch**, as printed on the barcode-backed pack image—not 500 g. Its pack conversion is 908 g.
- **Bambino Long Cut Vermicelli** is the Plain 450 g dry pack. The official panel declares calories, protein, carbohydrate, and fat but does not declare fibre. Nourish stores a numeric zero only as the arithmetic subtotal and visibly says **fibre not declared** in item, logging, day, and trend views.
- **Amul High Protein Paneer** is the current 400 g tin, not the older 200 g pouch.
- **Coca-Cola records** are separate exact SKUs: Original 750 ml, Zero Sugar 750 ml, Zero Sugar 8 × 250 ml, and Diet Coke 300 ml. A generic “any-brand zero cola” record is not allowed.

The following ambiguous or duplicate records were removed rather than guessed:

- generic any-brand zero cola and duplicate classic cola;
- duplicate Kinley Strong Soda;
- the weaker Epigamia Turbo entry that conflicted with the exact Cookies & Cream 250 ml record;
- a monk-fruit entry that collapsed different Sweetmate/Zeeero formulations into one product.

## Arithmetic acceptance rule

Every packaged panel is checked against its own macros:

protein × 4 + digestible carbohydrate × 4 + fat × 9 + fibre × 2

Packaged entries must be within 10% of declared energy. Reference foods get a wider 25% tolerance because composition tables may use food-specific Atwater factors. A candidate is rejected if its energy exceeds roughly 900 kcal/100 g or if protein + carbohydrate + fat exceeds 100 g/100 g.

This gate is executable in tests/prototype-logic.test.ts and tests/open-food-facts.test.ts; it is not reviewer memory.

## Product panels that remain reference-only

Parle-G, MAGGI Masala, Milky Mist Skyr, Cadbury Dairy Milk, Lay’s Magic Masala, Slurrp Farm Banana Oat, ACT II Sour Cream & Cheese, Kurkure Masala Munch, Get-A-Way Chocolate Brownie Fudge, Health Factory Pizza Base, Tang Orange, generic pav, and chana jor have useful researched records but the local purchase title did not prove the exact pack. They stay searchable for a deliberate manual choice and are not cardIQ quick-add matches.

Cosmix Classic Unflavoured is explicitly different from KP’s Indonesian Cacao purchase. The purchased flavour remains unresolved.

## Image policy

An icon is safer than the wrong photo.

- Exact commercial photos must match brand + product + flavour/form + pack size and are checked visually before entry.
- Generic photos must match the catalogue’s raw/cooked/dry form.
- Local files under public/food-images/ are allowed only for a visually confirmed exact pack.
- Remote image URLs fall back to a drawn category icon if they break.
- Existing photos are preserved by default; replacement requires the explicit --replace-existing flag.

The former free-text Commons search and automatic retailer scraper are retired because a plausible search result cannot prove the exact food or pack. scripts/source-wikipedia-photos.mjs now contains only a small generic allow-list and emits candidates that still require visual review. Branded and state-sensitive foods are excluded.

The audit found and removed real cross-object corruptions including cucumber shown as tomato, fried egg shown as cooking oil, Skippy peanut butter shown as almonds, paneer shown as tofu, brown rice shown as Greek yogurt, eggplant shown as lettuce, murukku shown as coconut water, and tamarind shown as rice flour. The photo applier now edits the exact TypeScript object through the compiler AST, rejects duplicate IDs and malformed URLs, writes atomically, and has failure-injection tests.

Current catalogue coverage is 54 visually accepted photos across 123 foods. The remaining 69 use the truthful icon fallback until an exact image can be checked; coverage is not increased by guessing.

## Recipe method

Meals in app/nutrition-data.ts are original weighed-ingredient assemblies. Displayed totals are recalculated from structured ingredient IDs and weights; oil is explicit. Filter labels are transparent product rules:

| Filter | Rule per displayed serving |
|---|---:|
| High protein | At least 25 g protein |
| Low fat | At most 10 g fat |
| High fibre | At least 8 g declared/calculated fibre |

Historical logs store immutable food/meal snapshots, so later catalogue edits do not rewrite what KP previously logged.
