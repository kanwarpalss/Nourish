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

## Panels transcribed from published sources

Some branded products KP buys repeatedly have no pack to hand, so their panels were found online on 2026-08-10. These are **Label mirror**, never Official label: a published panel is not the pack in KP's hand, however good the source.

Sources are ranked. An [Open Food Facts](https://world.openfoodfacts.org/) entry carries a barcode *and* a photograph of the actual label, which is the strongest of these. A manufacturer's own product page is next. Nutrition aggregators are weakest, because they are user-contributed and demonstrably disagree with each other.

| Product | Basis | Source strength |
|---|---|---|
| Milky Mist Greek Yogurt, plain | 77 kcal / 100 g | Open Food Facts, barcode 8904083302292, label photo |
| The Health Factory Zero Maida Protein Bread | 242 kcal / 100 g | Open Food Facts, barcode 8908009059246, label photo |
| Epigamia Turbo 25 g protein milkshake | 141 kcal / 250 ml | Published panel |
| Cosmix No-Nonsense Plant Protein | 145 kcal / 38 g scoop | Published panel, unflavoured variant |
| So Good oat beverage, unsweetened | 59 kcal / 100 ml | Published panel, unsweetened variant only |
| Zero-sugar cola | 0 kcal / 100 ml | Coca-Cola India product page |
| Coca-Cola classic (full sugar) | 44 kcal / 100 ml | Coca-Cola India product page — manufacturer's own, so Official label |
| Parle-G glucose biscuits | 454 kcal / 100 g | Published panel |
| MAGGI 2-Minute masala noodles | 443 kcal / 100 g | Published panel |
| Milky Mist Skyr | 100 kcal / 100 g | Published panel |
| Cadbury Dairy Milk | 531 kcal / 100 g | Open Food Facts |
| Lay's India's Magic Masala | 555 kcal / 100 g | Published panel |
| Slurrp Farm multigrain cookies | 492 kcal / 100 g | Published panel, banana oat variant |

### The acceptance rule

Every transcribed value was cross-checked against its own macros before being entered: protein × 4 + available carbohydrate × 4 + fat × 9 + fibre × 2 must agree with the stated energy. A manufacturer's panel is their own arithmetic, so it should agree with itself closely; anything beyond about 6% was treated as unreliable and rejected.

This rule is now enforced by the test suite rather than left to judgement. Packaged entries (Official label, Label mirror) must agree within 10%; raw reference foods get 25%, because composition tables use food-specific Atwater factors and a 2 kcal difference on a cucumber is a large percentage. Unsweetened cocoa is explicitly exempt — USDA applies food-specific factors that are materially lower than the general ones, so the general calculation overstates it by design.

### Rejected, and why

- **Yogabar 26 g protein shake** — the published figures state 210 kcal against macros computing to 238.5, a 13.6% disagreement. One of the two numbers is wrong and there is no way to tell which.
- **So Good Barista Edition** — the figure found (112 kcal/100 ml) has no fat value and is roughly double every comparable oat beverage; the results also mixed the Indian product with Sanitarium's Australian one of the same brand name. Only the unsweetened variant was accepted.
- **Slurrp Farm cookies** — no nutrition panel found in any source.
- **Sid's Farm High Protein Milk** — protein and energy are published but carbohydrate is not. The carb figure could be back-solved from the other two, but that is circular: the derived value would then "agree" with the energy by construction and the cross-check would prove nothing.
- **Kurkure** — a corn puff, not a potato crisp; it must not borrow the Lay's panel.
- **Cadbury Nutties** — chocolate-coated peanuts, not a solid bar.
- **NOICE Jeera Coriander Kulcha** — a bread named after its flavouring. An early version of the spice rule matched it to cumin at 375 kcal/100 g, which is why spice matches now require the spice form ("jeera powder", "jeera whole") rather than the bare word.
- **Whole chillies with stem** — fresh and dried chillies differ several-fold; only an explicit "chilli powder" resolves.

Generic reference values were used, and labelled Reference rather than Label mirror, for rusk, murukku, coconut water, and the aromatics and spices (lemon, lemongrass, ginger, coriander leaf and powder, mint, cumin, chilli powder, tamarind, sugar, rice flour, corn starch, kala chana, tea). These are composition-table figures for the food in general, not a specific brand's pack.

Anything not listed here stays **needs label** with quick-add disabled. A missing number is recoverable; a wrong one silently corrupts every total it touches.

## Recipe method

The meals in `app/nutrition-data.ts` are original recipe assemblies, not nutrition copied from recipe websites. Each ingredient has a structured food ID and specified edible weight. The app recalculates every displayed meal total from those records whenever it starts. Cooking oil is counted explicitly, and an alternative ingredient is not silently treated as nutritionally identical.

The prototype’s filters are transparent product rules, not regulatory label claims:

| Filter | Prototype rule |
|---|---:|
| High protein | At least 25 g protein per displayed serving |
| Low fat | At most 10 g fat per displayed serving |
| High fibre | At least 8 g fibre per displayed serving |

Before persistent logging, these structured calculations will gain recipe version IDs so a later ingredient or label change never rewrites an older food log.


## Dependency security note (2026-08-10)

`npm audit` reported 16 high-severity advisories going into this session; 14 are fixed by
upgrading next, react, react-dom, react-server-dom-webpack, vite, @cloudflare/vite-plugin,
wrangler and eslint-config-next to their latest compatible non-major releases, plus a scoped
`overrides` entry pinning the `esbuild` dependency inside `@esbuild-kit/core-utils` (used only
by drizzle-kit's dev CLI) to a patched 0.25.x release without touching drizzle-kit itself.

Two remain, both traced to `image-size`@2.0.2:
- `image-size` itself (DoS via malicious ICNS/JXL/HEIF parsing)
- `vinext`, which depends on it

There is no patched `image-size` release — 2.0.2 is the latest published version and is still
inside the vulnerable range. Every vinext release checked, including its newest 1.0.0-beta.5
prerelease, pins `image-size` at the exact same vulnerable version. `npm audit fix --force`
offers to "fix" this by downgrading vinext to 0.0.45 — five patch versions back — but that
version simply predates the `@vercel/og` feature that pulls in `image-size`; it is a downgrade
that drops functionality, not a security fix, and was rejected on that basis.

The vulnerable code path is `@vercel/og` Open Graph image generation. Confirmed by
`grep -rn "vercel/og\|ImageResponse\|next/og\|opengraph-image" app/` that Nourish's own code
never calls it, so the vulnerable parser is never reached by anything this app actually does.
Revisit this line when image-size ships a patch.