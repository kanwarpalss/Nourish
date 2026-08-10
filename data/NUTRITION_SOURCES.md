# Nutrition seed-data evidence

> **Scope:** This is a researched seed catalogue for the local design prototype, prepared on 2026-08-08. It is not yet the cardIQ order import and it does not replace the label on the exact pack KP receives.

## Source hierarchy

1. **Exact product:** the manufacturer’s current nutrition panel.
2. **Indian raw ingredient:** ICMR–National Institute of Nutrition, *Indian Food Composition Tables 2017*.
3. **Missing/supplementary raw ingredient:** USDA FoodData Central Foundation or SR Legacy data.
4. **Retailer or label mirror:** allowed only as a visibly weaker provisional match; the exact pack must be rechecked before production promotion.

## Primary references

- [ICMR–NIN Indian Food Composition Tables 2017](https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf)
- [ICMR–NIN Dietary Guidelines for Indians 2024](https://www.nin.res.in/dietaryguidelines/index.html)
- [USDA FoodData Central](https://fdc.nal.usda.gov/)
- [FSSAI nutrition-labelling guidance](https://www.fssai.gov.in/upload/uploadfiles/files/Guidelines_Nutrition_Labelling_16_08_2018.pdf)
- [Amul High Protein Paneer official panel](https://old.amul.com/products/amul-HP-tin-paneer-info.php)
- [Amul High Protein Buttermilk official panel](https://old.amul.com/products/amul-highprotein-buttermilk-info.php)
- [MuscleBlaze Biozyme official panel](https://biozyme.muscleblaze.com/what-is-biozyme-whey.php)
- [KMF/Nandini GoodLife product family](https://www.nandinigoodlife.in/)

## Provisional label mirrors

- [Nandini GoodLife toned milk retailer label](https://www.bigbasket.com/pd/100285703/nandini-goodlife-toned-milk-1-l-carton/)
- [Epigamia Natural Greek Yogurt label mirror](https://www.eatthismuch.com/calories/greek-yogurt-natural-1806163)

These two entries are intentionally marked **Label mirror** in the interface. During the cardIQ phase, the barcode/pack variant and its photographed label must agree before they are treated as exact products.

## Recipe method

The meals in `app/nutrition-data.ts` are original recipe assemblies, not nutrition copied from recipe websites. Each ingredient has a structured food ID and specified edible weight. The app recalculates every displayed meal total from those records whenever it starts. Cooking oil is counted explicitly, and an alternative ingredient is not silently treated as nutritionally identical.

The prototype’s filters are transparent product rules, not regulatory label claims:

| Filter | Prototype rule |
|---|---:|
| High protein | At least 25 g protein per displayed serving |
| Low fat | At most 10 g fat per displayed serving |
| High fibre | At least 8 g fibre per displayed serving |

Before persistent logging, these structured calculations will gain recipe version IDs so a later ingredient or label change never rewrites an older food log.
