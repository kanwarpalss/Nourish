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

### Third research pass (2026-08-10)

Twelve more panels found and cross-checked, taking coverage of KP's imported purchase history to 163 of 194 food items (163/194 = 84% of items; 88% of purchase events, since these skew toward things he buys more than once).

| Product | Basis | Source strength |
|---|---|---|
| Sid's Farm High Protein Milk | 63.2 kcal / 100 ml | Published panel, 250 ml pack |
| ACT II Sour Cream & Cheese popcorn | 496 kcal / 100 g | Published panel |
| Cadbury Nutties | 511 kcal / 100 g | Open Food Facts, barcode 7622202031618 |
| Weikfield Custard Powder (dry) | 342 kcal / 100 g | Published panel |
| Kurkure Masala Munch | 555 kcal / 100 g | Published panel |
| Kinley Strong Soda Original | 0 kcal / 100 ml | Published panel, this exact variant |
| Get-A-Way Chocolate Brownie Fudge ice cream | 182 kcal / 100 g | Published panel |
| The Health Factory Zero Maida Pizza Base | 239.7 kcal / 100 g | Published panel |
| Tang orange drink mix (dry powder) | 380 kcal / 100 g | Published panel |
| Monk fruit sweetener (Sweetmate, Zeeero) | 0 kcal / 100 g | Manufacturer zero-calorie claim, both brands |
| Pav / soft bread roll | 288 kcal / 100 g | Published panel — **Britannia's pack, not SMOOR's**; marked Reference, not Label mirror |
| Chana jor namkeen | 517 kcal / 100 g | Published panel — **Haldiram's pack, not Bhujialalji's**; marked Reference, not Label mirror |

The last two are a different kind of entry from everything above: a real published panel, but for a different manufacturer's pack than the one KP actually bought. They are deliberately tagged **Reference**, not Label mirror — the same tier already used for murukku and rusk-toast — because "Label mirror" is reserved for a panel that is genuinely close to being the product's own label. A generic pav or a generic chana jor snack is close enough across brands to be useful; it is not the same claim as "this is Britannia's/Haldiram's own number for KP's SMOOR/Bhujialalji pack."

### Rejected in this pass, and why

- **So Good Barista and Caramel variants** — re-searched directly against Open Food Facts by product name; confirmed no Indian "So Good" entry exists there at all. Every result for "So Good oat" is Sanitarium's Australian/NZ product line, a different manufacturer despite the shared brand name. Only the unsweetened variant (already entered) has a verified Indian-market panel.
- **Yogabar Cold Coffee protein shake** — two more figures found (207 kcal and 220 kcal per 250 ml) neither with a complete macro breakdown to cross-check, on top of the double-chocolate figure already rejected for 13.6% self-inconsistency. Three different numbers for the same product line with no way to verify any of them.
- **Right Shift Roasted Navrattan Mix** — its own retailer pages (BigBasket, Blinkit) block automated fetches; no complete panel found elsewhere.
- **HERSHEY'S Chocolate Syrup** — sources disagreed by 16% (237 kcal vs 276 kcal per 100g) with no way to tell which is current.
- **Veeba Salsa Dip, Tata Sampann Chhole Masala, Theobroma cheese crackers, DRIX Better Cola, RAW POP sodas, NOICE kulcha/nachos/batter/kombucha, Eat Better Co laddoo, Supply6 electrolyte mix, Baker's Dozen breadsticks/garlic bread, Aptamil infant formula** — no reliable brand-specific panel found. Generic garlic-breadstick estimates ranged 150–500 kcal/100g depending on brand, too wide to use as a stand-in.

Anything not listed here stays **needs label** with quick-add disabled. A missing number is recoverable; a wrong one silently corrupts every total it touches.

### Branded cereals and pulses (2026-08-14)

Poha, vermicelli and chana were previously only in the catalogue as generic
reference grains, but they are bought by brand and every such pack carries a
printed panel. Three brands entered, plus one ready-to-eat pouch.

| Product | Basis | Source strength |
|---|---|---|
| Fortune Poha, thick | 361.3 kcal / 100 g dry | Open Food Facts, barcode 8906008812817, label photo |
| Bambino Long Cut Vermicelli | 347 kcal / 100 g dry | Manufacturer's own product page — Official label |
| 24 Mantra Organic Kabuli Chana | 342.9 kcal / 100 g dry | Open Food Facts, barcode 8904083512219, label photo |
| MTR Instant Poha | 149 kcal / 60 g pouch | Open Food Facts, barcode 8901042967325, label photo |

Two deliberate choices:

- **Photos are committed to `public/food-images/`, not hot-linked.** At roughly
  8–10 KB each a thumbnail costs almost nothing in Git, and it cannot break when
  a retailer reorganises its CDN. The 61 hot-linked photos already in the
  catalogue are a standing risk worth migrating the same way.
- **Bambino's pack declares no dietary fibre**, so the entry claims none rather
  than borrowing a plausible figure from another semolina product. Its source
  label says so where KP can see it.

Everything is **dry weight**. Cooked poha, chana and vermicelli roughly triple,
so a serving conversion is attached where a natural portion exists rather than
leaving KP to convert in his head.

#### Rejected in this pass, and why

- **Tata Sampann Unpolished Toor Dal** — the found panel (364 kcal against 18.2 g
  protein, 64.3 g carbohydrate, 1.3 g fat, 11.6 g fibre) computes to 318.5 kcal
  under the general Atwater calculation, a 12.5% disagreement. That clears the
  loose bound for a raw reference food but fails the packaged bound, which is the
  tier a brand's own pack arrives in — the same reasoning that rejected the
  Yogabar shake. The dal is a real product KP buys and it does have a panel;
  this particular transcription is simply not trustworthy enough to enter, and
  it should be re-sourced from the pack in hand.
- **Open Food Facts' Tata Sampann poha listing** — declares 722 kcal and 162.8 g
  of carbohydrate per 100 g. Self-consistent under 4/4/9, so the energy
  cross-check accepts it, but 100 g of food cannot contain 162.8 g of anything;
  the values describe a 200 g serving. `scripts/audit-open-food-facts.ts` now
  rejects any candidate whose macros outweigh their own basis, which is the check
  that catches this class.

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