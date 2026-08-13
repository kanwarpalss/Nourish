# Nutrition seed-data evidence

> **Scope:** This is a researched seed catalogue for the local design prototype, prepared on 2026-08-08. It is not yet the cardIQ order import and it does not replace the label on the exact pack KP receives.

## Source hierarchy

1. **Exact product:** the manufacturer’s current nutrition panel.
2. **Indian raw ingredient:** ICMR–National Institute of Nutrition, *Indian Food Composition Tables 2017*.
3. **Missing/supplementary raw ingredient:** USDA FoodData Central Foundation or SR Legacy data.
4. **Retailer or label mirror:** allowed only as a visibly weaker provisional match; the exact pack must be rechecked before production promotion.

## Primary references

- [ICMR–NIN Indian Food Composition Tables 2017](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf)
- [ICMR–NIN Dietary Guidelines for Indians 2024](https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI24thJune2024fin.pdf)
- [USDA FoodData Central](https://fdc.nal.usda.gov/)
- [FSSAI nutrition-labelling guidance](https://www.fssai.gov.in/upload/uploadfiles/files/Guidelines_Nutrition_Labelling_16_08_2018.pdf)
- [Amul High Protein Paneer official panel](https://old.amul.com/products/amul-HP-tin-paneer-info.php)
- [Amul High Protein Buttermilk official panel](https://old.amul.com/products/amul-highprotein-buttermilk-info.php)
- [MuscleBlaze Biozyme official panel](https://biozyme.muscleblaze.com/what-is-biozyme-whey.php)
- [KMF/Nandini GoodLife product family](https://www.nandinigoodlife.in/)

## Branded Indian staples

Added 2026-08-12. Cereals and pulses are bought by brand, and a branded grocery
almost always has a printed panel, so these are stored as exact products rather
than as generic reference foods. Barcodes are recorded so the pack in the
kitchen can be reconciled against the entry.

| Product | Basis | Barcode | Evidence |
|---|---|---|---|
| Fortune Poha · thick | per 100 g dry | `8906008812817` | [Open Food Facts](https://world.openfoodfacts.org/product/8906008812817) |
| Bambino Long Cut Vermicelli | per 100 g dry | — | [Bambino official product page](https://bambinopasta.in/products/bambino-long-cut-vermicelli) |
| 24 Mantra Organic Kabuli Chana | per 100 g dry | `8904083512219` | [Open Food Facts](https://world.openfoodfacts.org/product/8904083512219) |
| Tata Sampann Unpolished Toor Dal | per 100 g dry | `8904043926216` | [Open Food Facts](https://world.openfoodfacts.org/product/8904043926216) |
| MTR Instant Poha | per 60 g pouch | `8901042967325` | [Open Food Facts](https://world.openfoodfacts.org/product/8901042967325) |

Two things about these entries are deliberate:

- **Pulses and cereals are stored dry.** Cooked weight roughly triples, so
  logging 100 g of cooked chana against a dry basis would overstate it about
  threefold. Every dry staple above says `dry` in its pack size, which the item
  card prints next to the serving basis.
- **Bambino declares no dietary fibre**, so the entry claims none rather than
  inventing a plausible number. Its source label says so in the interface.

Pack photographs are committed under `public/food-images/` and referenced as
`/food-images/<id>.jpg`, so the catalogue carries its own images with no
dependency on a retailer keeping a URL alive.

### Rejecting an implausible panel

Open Food Facts is crowd-sourced, and a pack value entered against the wrong
basis is the common failure. Tata Sampann's poha listing declares 722 kcal and
162.8 g of carbohydrate per 100 g — internally consistent with 4/4/9, but 100 g
of food cannot contain 162.8 g of anything; the values describe a 200 g serving.
`scripts/audit-open-food-facts.ts` now rejects any candidate whose macros exceed
its own basis, and that listing is excluded from this catalogue.

## Provisional label mirrors

- [Nandini GoodLife toned milk retailer label](https://www.bigbasket.com/pd/100285703/nandini-goodlife-toned-milk-1-l-carton/)
- [Epigamia Natural Greek Yogurt label mirror](https://www.eatthismuch.com/calories/greek-yogurt-natural-1806163)

These two entries are intentionally marked **Label mirror** in the interface. During the cardIQ phase, the barcode/pack variant and its photographed label must agree before they are treated as exact products.

## Searching for a label before giving up

"No label found" is almost always a search failure, not an absent label.
`scripts/audit-open-food-facts.ts` previously called Open Food Facts'
`/api/v2/search` with `search_terms`, which that endpoint ignores: it returned
the first page of the entire 4.6-million-product database, so every food was
scored against the same unrelated products and written off. The lookup now uses
`/cgi/search.pl`, retries with progressively broader queries, and reports an
explicit status — `matched`, `weak`, `exhausted` or `error` — so a rate-limited
request is never mistaken for a food that has no nutrition data.

Order of effort before accepting that a branded item has no label:

1. Open Food Facts by barcode, then by brand and product name.
2. The manufacturer's own product page.
3. A major retailer listing (BigBasket, Amazon, Instamart) as a label mirror.
4. Only then a generic reference food — and marked as such, never as the brand.

## Recipe method

The meals in `app/nutrition-data.ts` are original recipe assemblies, not nutrition copied from recipe websites. Each ingredient has a structured food ID and specified edible weight. The app recalculates every displayed meal total from those records whenever it starts. Cooking oil is counted explicitly, and an alternative ingredient is not silently treated as nutritionally identical.

The prototype’s filters are transparent product rules, not regulatory label claims:

| Filter | Prototype rule |
|---|---:|
| High protein | At least 25 g protein per displayed serving |
| Low fat | At most 10 g fat per displayed serving |
| High fibre | At least 8 g fibre per displayed serving |

Before persistent logging, these structured calculations will gain recipe version IDs so a later ingredient or label change never rewrites an older food log.
