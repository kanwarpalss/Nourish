# Health — Product Specification

> **Working product name:** Nourish. The repository and canonical project name remain **Health** until KP approves a permanent name.
>
> **Status:** Functional browser-local prototype with a read-only cardIQ food snapshot. The researched catalogue contains 123 foods, 18 exact purchase-title matches, explicit provenance, and conservative icon fallbacks where an exact photo is unproven. Track has a real multi-day diary, editable targets, history/trends, weight monitoring, and non-destructive backup import. A backed-up local database is still pending.

## §1 Product promise

Health is a private, always-on nutrition companion for one person. It closes the loop between deciding what to eat and understanding what was actually eaten:

1. **Plan** has two clear paths: search exact products/raw ingredients, or choose researched complete meals; both feed one shared daily draft.
2. **Track** makes logging quick enough to sustain, then turns daily entries into useful weekly and monthly patterns.
3. **Later:** cardIQ purchase history becomes a personal catalogue of exact products that can be logged in one tap and prioritised while planning.

The product should feel like an encouraging, highly informed food partner—not a spreadsheet, medical device, or scolding diet coach.

### Observable success

- A repeated meal can be logged in under five seconds.
- A new food can be logged with serving, calories, protein, carbohydrates, and fat in under thirty seconds.
- Item and meal selections accumulate into one transparent calorie/macro/fibre draft.
- Changing grams, millilitres, scoops, packs, or servings recalculates every displayed nutrient immediately from one serving basis.
- Every nutrition value visibly distinguishes label/reference/calculated/estimated data.
- Daily, weekly, and monthly views use the same canonical log entries and never disagree.
- The complete personal database and backups live on the Mac Mini.

## §2 Information architecture

There are exactly two top-level areas.

| Area | Subsection | Purpose |
|---|---|---|
| **Plan** | Items | Search exact products and raw ingredients; inspect serving, macros, fibre, availability, and provenance; add them to the shared draft |
|  | Meals | Search ingredient-calculated meals; filter by high protein, low fat, high fibre, dietary pattern, and time; add them to the shared draft |
| **Track** | Today | Daily energy, macros, timeline, quick-add, and next useful action |
|  | Weight | Compact dated weight log and optional trend chart, placed within Today rather than creating a third top-level area |
|  | History | Calendar/day review and correction of previous logs |
|  | Trends | Weekly/monthly energy and macro patterns with restrained insights |
|  | Purchases | Personal catalogue derived from cardIQ orders, with match/review state |

Settings, profile, backups, integrations, and data sources are utilities—not a third product area.

## §3 Core interaction design

### Global shell

- Desktop: persistent dark sidebar, PLAN/TRACK switch, contextual subsection navigation.
- Mobile: compact sticky header, PLAN/TRACK switch, horizontally scrollable subsection navigation, and a persistent Log food action while tracking.
- Changing sections preserves local draft state during the session.
- High-frequency actions are visible; low-frequency configuration stays out of the primary viewport.

### Visual system

The approved direction mixes **Verdant Precision** and **Ink & Citrus**:

- Mineral canvas and paper surfaces provide calm, breathing room, and food-friendly warmth.
- Deep ink/forest cards are deliberately sprinkled among light content to create rhythm and focus.
- Chartreuse/lime is progress and positive action; tangerine is logging/energy; turmeric and clay are supporting nutrition categories.
- Large tabular numerals carry the data. Short uppercase labels provide navigation and hierarchy.
- 12–26 px radii: tighter for controls, broader for important cards. No bubbly wellness clichés.
- Animation is limited to state change, selection, progress, drawers, and confirmation. Reduced-motion is respected.
- Meaning never depends on colour alone; labels, values, and status words remain visible.

### Prototype interactions

The current research build demonstrates:

- Navigation across the two Plan subsections and four Track subsections.
- Item/product search with source strength and evidence links.
- Meal filtering and a complete recipe drawer with weighed ingredients, method, fibre, and calculation note.
- One shared draft that accepts either individual items or complete meals.
- Exactly two Log Food modes: **Single Items** and **Meals**. Single Items can be filtered as Packaged Food, Open Ingredient, or Ordered Food; the old Combination/Dishes/Ingredients tab maze is removed.
- Quantity editing by grams, millilitres, pieces, packs, scoops, or servings where an exact conversion exists, with the amount being added shown in high contrast.
- Type-specific identity: Packaged Food requires Brand + Item Name, Ordered Food requires Restaurant/Brand + Menu Item, and Open Ingredient requires only its ingredient name. Variant, serving/conversion, and macros remain editable.
- Reusable Meals containing one or more Single Items. Logging produces one expandable diary row; component quantity edits affect that diary entry only.
- A zero-result search can open a blank new-item form without depending on an existing selection. The modal owns scrolling while the background page is locked.
- Real History and Trends derived from the multi-day diary; missing days remain gaps rather than zero intake.
- Dated body-weight logging with same-day correction, safe bounds, and an optional trend chart.
- Purchase catalogue with exact-match/review state. Unresolved items are visible but cannot inherit similar-product nutrition.

## §4 Functional requirements

### 4.1 Nutrition calculation

For user-entered macros, energy defaults to the Indian labelling factors:

| Component | Energy |
|---|---:|
| Available carbohydrate | 4 kcal/g |
| Protein | 4 kcal/g |
| Fat | 9 kcal/g |
| Dietary fibre, when separately supplied | 2 kcal/g |
| Alcohol, when applicable | 7 kcal/g |

The basic macro planner converts percentages into grams:

- protein grams = target kcal × protein percentage ÷ 4
- carbohydrate grams = target kcal × carbohydrate percentage ÷ 4
- fat grams = target kcal × fat percentage ÷ 9

Package-label calories remain the displayed authority for exact products. A calculated 4/4/9 value is retained for comparison rather than silently overwriting the label. Differences can arise from fibre, polyols, alcohol, rounding, or label tolerances.

### 4.2 Food library

Every canonical food stores:

- human name, brand, variant, package size, and optional barcode/retailer identifiers;
- serving definitions in grams/millilitres and natural Indian units where useful (roti, katori, glass, piece, tablespoon);
- calories, protein, carbohydrate, fat, fibre, sugar, sodium, and optional micronutrients;
- field-level source, source date, confidence, and evidence URL/image reference;
- raw-versus-cooked state and edible portion;
- aliases and a link to any retailer order line that matched it.

Search ranking: exact personal favourite → recent purchase → repeated meal → exact catalogue match → generic reference food → estimated result.

### 4.3 Recipes

- A recipe is a versioned ingredient list plus yield and portion definitions.
- Nutrition is calculated from ingredient weights and apportioned by serving weight or serving count.
- Oil, ghee, marinades, cooking loss, water gain, and discarded portions must be explicit.
- Editing an ingredient creates a new recipe version; old logs retain the version eaten.
- Discovery cards may link to external inspiration, but the saved personal recipe is the canonical version used for calculation.
- Current transparent filters are high protein (at least 25 g/serving), low fat (at most 10 g/serving), and high fibre (at least 8 g/serving), plus dietary pattern and preparation time. Later filters include allergens, region/cuisine, equipment, meal type, calories, budget, pantry fit, and season.

### 4.4 Planning assembly

The two Plan catalogues feed one shared day plan. A later target-assist layer can accept:

- daily calorie target;
- protein/carbohydrate/fat percentages totalling 100%;
- number and approximate timing of meals;
- vegetarian/egg/non-vegetarian/vegan pattern;
- allergies and hard exclusions;
- preferred cuisines, preparation time, budget, equipment, and pantry preference.

The optimiser should use discrete, natural serving increments—one roti, half a katori, one egg—not absurd fractional foods. Calories/macros are soft targets with visible tolerance. Hard safety constraints and exclusions are never relaxed.

Ranking goals, in order:

1. respect exclusions and valid serving bounds;
2. minimise calorie and macro distance;
3. preserve realistic meal size and preparation effort;
4. prefer liked, available, recently purchased, and seasonal ingredients;
5. avoid repeating the same core recipe or dominant ingredient;
6. reduce waste by reusing perishables across the week.

When automatic generation is added inside the two-section structure, it returns at least three diverse plans and explains its small remaining variance. Swapping one meal rebalances the other unlocked meals; locked meals never change.

### 4.5 Food logging

Supported paths:

- quick-add a recent/favourite/repeated item;
- copy a meal or day;
- search the canonical library;
- log a saved recipe or planned meal;
- add an exact recent purchase;
- edit quantity/volume before adding or from the logged timeline while calories and all macros update live;
- quick-add only calories/macros when detail is unavailable;
- create a custom food from a package label.

Every log records event time, meal slot, food/recipe version, serving quantity, grams, calculated nutrition, entry method, and optional note. Editing a food later does not rewrite history.

Current browser-local implementation stores an immutable nutrition snapshot on every new log:
the visible quantity/unit, original nutrition basis, alternate-unit conversion, identity,
provenance, and final calculated totals. This is the mechanism that prevents a later custom-food
or catalogue edit from rewriting an earlier day.

### 4.8 Weight monitoring

- Track · Today contains a compact body-weight subsection rather than a new top-level area.
- Entries store a Bangalore-local date and kilograms to one decimal place; 20–400 kg is the accepted guard range.
- One value per date is canonical; logging the same date corrects that date rather than duplicating it.
- Future dates are rejected. The trend uses actual entry dates and does not invent daily values between weigh-ins.

### 4.6 Trends

- Today shows eaten, target, remaining, macros, meal timeline, and one prioritised suggestion.
- History provides date-level review and correction.
- Weekly/monthly trends use averages, target-range days, and macro consistency—not streak shame.
- Missing or partial days are labelled; they are not treated as zero intake.
- The product may describe observed associations but must not diagnose or claim causation.

### 4.7 cardIQ purchase bridge — after design approval

cardIQ remains the source of truth for orders. Health owns food identity and nutrition.

The bridge imports only the minimum useful order fields: stable order ID, retailer, order date, item name, quantity, package clues, retailer product ID/URL when available, and refund/cancellation state. Address, card, transaction, and payment evidence do not enter Health.

Pipeline:

1. Import one year of Instamart, Amazon Now, and BigBasket order lines.
2. Preserve the untouched source description in a private staging record.
3. Normalise brand, product, variant, size, multipack, and unit.
4. Classify non-food and ambiguous items out of the default queue.
5. Match exact product identity using barcode/retailer ID first, then brand + variant + pack.
6. Enrich from package-label facts and trusted databases.
7. Assign `matched`, `needs_review`, or `unmatched`; never force a guess.
8. Promote approved items to the canonical food library and quick-add suggestions.
9. Re-import idempotently using cardIQ’s stable order ID plus order-line identity.

Amazon’s export does not reliably identify the Now channel by itself, so that classification needs secondary evidence. The app must show `Amazon — channel unconfirmed` rather than fabricating certainty.

## §5 Decisions Log

| Date | Decision | Rejected alternative | Why |
|---|---|---|---|
| 2026-08-08 | Two top-level areas only: Plan and Track | Separate Recipes, Planner, Diary, Analytics, and Purchases products | Preserves a simple mental model while allowing rich subsections |
| 2026-08-08 | Review the complete dummy-data UI before real imports | Start with cardIQ data extraction | Prevents retailer schemas from dictating the experience and reduces rework |
| 2026-08-08 | Verdant Precision structure mixed with Ink & Citrus pop | One uniformly light or uniformly dark theme | The mix balances everyday clarity with character and focal contrast |
| 2026-08-08 | Local Mac Mini database is Health’s source of truth | Reuse cardIQ’s database for nutrition | Keeps domains independent, private, and recoverable |
| 2026-08-08 | Store field-level nutrition provenance and confidence | One unqualified nutrition number | Package labels, reference foods, recipes, and estimates have materially different trust |
| 2026-08-08 | Natural-unit discrete meal optimisation | Pure continuous macro solver | Continuous optimisation creates inedible fractions and frustrating plans |
| 2026-08-08 | Package label calories remain authoritative for exact products | Always replace energy with 4/4/9 | Fibre, polyols, alcohol, and rounding can legitimately create differences |
| 2026-08-08 | Plan has exactly two subsections: Items and Meals | Separate Discover, Library, Meal Studio, and Week Plan navigation | Matches the two planning entry points KP actually uses and removes navigation overhead |
| 2026-08-22 | Deleting anything records a tombstone | Delete by simply removing the record | Restore is additive by design, so with no record of a deletion any older backup silently resurrects every deleted meal, food and weigh-in |
| 2026-08-22 | Small deletes are instant with a 10s Undo | A confirmation modal on every delete | A modal per delete makes tidying a chore; a working Undo is the stronger guarantee. Only whole-day and delete-everything confirm |
| 2026-08-30 | Ids come from `crypto.getRandomValues`, never `randomUUID` | Keep `randomUUID` and serve the app over HTTPS | `randomUUID` needs a secure context, which a plain-HTTP tailnet address is not. Adding TLS to a private local app is real ongoing cost (certificates, renewal, trust on every device) to regain one convenience function that has a restriction-free equivalent |
| 2026-08-30 | A source scan bans every secure-context-only Web API from client code | Fix `randomUUID` alone and move on | The bug was invisible for weeks because tests and dev both run on `localhost`, the one origin exempt from the rule. `clipboard`, `mediaDevices` and `subtle` would each fail the same silent way, so the whole class is refused rather than one instance |
| 2026-08-30 | Food photos get their own `food_photos` table and routes | Reuse `log_photos` keyed by food id | The 30-day sweep exists to bound meal-photo storage. A food's picture is catalogue data that must live as long as the food, so sharing the table would silently strip pictures off items added months earlier |
| 2026-08-30 | A failed photo upload clears the preview | Leave the picture on screen and show an error beside it | The preview appears the instant a file is picked, so leaving it visible after a failure is the app implying it saved something it did not — the same class of lie the 'saved on the Mac Mini' wording already forbids |
| 2026-08-22 | "Delete everything" also clears tombstones | Keep them, so the reset is absolute | Otherwise restoring KP's own backup after a reset returns nothing — a trap |
| 2026-08-22 | Today drops to 2 columns below 1440px | Keep the 1260px breakpoint | Three columns need 1034px and a 1280px window offers ~926px; the old breakpoint overflowed the page sideways by 117px |
| 2026-08-23 | Diary stored in SQLite via `node:sqlite` on the host | Cloudflare D1 (already scaffolded) | `vinext start` is a plain `node:http` server, not workerd, so D1 needs miniflare — whose state would live inside `releases/<id>/` and be orphaned by every release |
| 2026-08-23 | Local-first: browser copy is the working copy, SQLite is durable | Server as sole source of truth | Logging food must not wait on a network round trip, and the app has to work with the Mac Mini asleep |
| 2026-08-23 | One JSON document per profile, with a revision counter | Normalised days/logs/foods tables | The diary's shape, validation and merge rules already live in `local-nutrition-state.ts`; a second definition in SQL is exactly the divergence ARCH-04 warns about |
| 2026-08-23 | Diary API is same-origin under `/api/nourish`, with no CORS headers | A second public port with permissive CORS | Open CORS lets any site KP visits read the diary off the tailnet address, and an `http://` call from an `https://` page is blocked as mixed content |
| 2026-08-23 | Sync propagates deletions; restore never does | One shared merge function | Restoring a file is one-way and may not delete anything; syncing is two-way and must carry a deletion across, or every sync resurrects it |
| 2026-08-23 | Each person gets a separate diary; first profile keeps the original storage keys | One shared household diary | KP asked for separate diaries; reusing the original keys means the existing diary becomes his with no migration step to get wrong |
| 2026-08-23 | cardIQ and the static sites belong in the cloud; Nourish, Wealth, Watch Book and whats-up stay on the Mac Mini | Push every app to Vercel | Vercel functions are not tailnet members, so "apps on Vercel, data on the Mac Mini" cannot work without exposing the Mini publicly. Wealth writes files to disk and whats-up holds a WhatsApp socket open — serverless can host neither |
| 2026-08-08 | Filter badges use visible numeric rules | Unexplained “healthy” labels | A meal only earns High protein (25 g+), Low fat (≤10 g), or High fibre (8 g+) when its displayed serving meets the rule |
| 2026-08-08 | Quantity is edited before a log is committed | One-tap fixed-serving logging only | Grams, millilitres, scoops, packs, and servings all update nutrition from the same evidence-backed basis |
| 2026-08-09 | cardIQ imports create an ignored local food snapshot | Embed cardIQ credentials or raw orders in Nourish/Git | Keeps cardIQ the source of truth, prevents a second live database dependency, and never commits purchase history |
| 2026-08-09 | Persist the active food diary and Plan draft in browser-local storage | Reset logs and plan entries on reload | Lets KP start using the local app immediately while a backed-up Mac Mini database remains a separate, deliberate phase |
| 2026-08-09 | Today contains only food KP actually logs | Mix illustrative meals into Today totals or its timeline | A real diary must never make sample intake look consumed |
| 2026-08-09 | Dashboard time and diary date use `Asia/Kolkata` | Rely on server location or a fixed greeting/date | Keeps Bangalore greetings correct and prevents yesterday's entries leaking into today |
| 2026-08-09 | Every illustrative target, trend, insight, and meal suggestion is explicitly labelled Sample | Let polished preview data resemble personal history | KP must be able to distinguish researched catalogue facts, imported purchases, and UI examples at a glance |
| 2026-08-10 | An uncertain purchase match shows “needs label” with quick-add disabled | Show a best-guess macro at a lower confidence badge | A number next to a ＋ button will be tapped; a wrong macro is worse than a missing one |
| 2026-08-10 | Purchase classification and matching run in the app when the snapshot loads | Trust the `matchedFoodId` stored in the import file | A matcher fix then reaches KP immediately, with no cardIQ re-import; the snapshot records what was bought, the app decides what it means |
| 2026-08-10 | Whole-word matching for anything that assigns macros; substring matching only for listing an item in Purchases | One matching rule everywhere | Precision is required where nutrition is attached (“sore thrOAT” is not oats); leniency is safe where nothing is attached (“cornflour” is still food) |
| 2026-08-10 | Generic dairy/ingredient references remain searchable but never auto-attach to a branded cardIQ purchase | Use a legally standardised grade or similar ingredient as an automatic purchase match | KP requires exact Brand + Item + Variant/pack identity because actionable one-tap health logging cannot safely treat a near-match as equivalent |
| 2026-08-10 | Everyday dishes are composites with prefilled, individually editable component weights | One fixed calorie figure per dish | A chapati is however much atta went into it and a sabzi is however much oil was used; a correctable default is more truthful than a fixed number |
| 2026-08-10 | Dry and cooked pulses are separate foods | One entry per pulse | A retail pack is dry; using the cooked figure understates a 500 g pack of moong dal more than threefold |
| 2026-08-10 | Adding a food keeps the logger open; editing an entry closes it | Close after every add | A real plate is several foods, so a multi-item meal should be one flow; an edit is finished when applied |
| 2026-08-10 | Fullness is computed from protein, fibre and energy density, labelled “est.” | Hand-assign satiety-index values per food | A computed score cannot drift from the macros it describes and self-corrects when a macro is fixed; hand-typed values have partial coverage and nothing to check them against |
| 2026-08-10 | Numeric meal badges are derived from the thresholds they advertise | Hand-typed tag strings | A typed badge silently contradicted the number beside it once an ingredient changed |
| 2026-08-10 | Published nutrition panels may be transcribed from the web, marked Label mirror | Only accept a panel photographed from the pack in hand | Refusing to look up a published panel is not caution, it is just a gap; the tier system already exists to record that a mirror is weaker than the pack |
| 2026-08-10 | A transcribed panel is rejected unless its macros agree with its stated energy | Trust the source and enter the number | Nutrition aggregators are user-contributed and disagree; the Yogabar figures were 13.6% self-inconsistent, so one of the two numbers was simply wrong |
| 2026-08-10 | The energy cross-check is enforced by the suite, with a tighter bound for packaged panels than raw foods | Leave it to reviewer judgement each time | A manufacturer's panel is their own arithmetic and should agree with itself; composition tables legitimately use food-specific factors |
| 2026-08-10 | KP can rename and hand-correct the macros of any logged entry — composite, catalogue item, or meal alike | Only composites' component weights are editable | A researched default is a starting point, not a ceiling; the same flexibility SPEC 4.5 already names ("quick-add only calories/macros when detail is unavailable") is now available for every food, not only ones missing a label |
| 2026-08-10 | A hand-edited entry is tagged the fourth provenance tier, "Estimated," and never overwrites the shared catalogue | Let the edit silently become the new catalogue truth | CLAUDE.md invariant 3 requires every value to carry a tier; mutating the catalogue would let one day's correction quietly change every future log of the same food |
| 2026-08-10 | 16 high-severity dependency advisories reduced to 2 via version bumps plus a scoped `overrides` entry for one nested esbuild copy | Downgrade vinext/drizzle-kit the way `npm audit fix --force` suggested | Both suggested downgrades removed functionality rather than patching anything; the two that remain (image-size/vinext) have no upstream fix at all, confirmed by checking every published vinext version including its unreleased beta |
| 2026-08-10 | A category-reference panel from a different brand (pav, chana jor namkeen) is tagged Reference, not Label mirror, even though it reaches KP via the "Exact product" matcher list | Only enter panels from the exact brand KP bought | The same real-panel-but-different-brand approach already used for murukku and rusk-toast; being findable at all beats leaving a frequently-bought snack with no macros, as long as the tier visibly says it is borrowed |
| 2026-08-10 | The diary keeps every day, capped at 400, and only today's slice is ever rewritten | One day held inline, replaced on rollover | The single-day store destroyed the previous day at every Bangalore midnight, and made a truthful History impossible |
| 2026-08-10 | History and Trends read the stored diary; averages divide by logged days, not calendar days | Keep polished sample charts until the database phase | Dividing by calendar days invents a fast for every unlogged day, which SPEC 4.6 forbids; an app used for health must not draw a chart out of nothing |
| 2026-08-10 | Daily targets are KP's own, editable and persisted, labelled "placeholder" until set | A fixed 2,150 kcal sample target | Every number on Today is measured against the target, so a placeholder must never be mistaken for a decision |
| 2026-08-10 | A failed save raises a persistent banner, not a toast | Toast, or silence | If the diary has stopped being written, KP must keep seeing that until it is fixed |
| 2026-08-10 | Every interactive control is at least 44 px tall on mobile | Keep the desktop density on phones | Inline controls rendered 12–30 px tall; logging happens one-handed in a kitchen |
| 2026-08-12 | cardIQ nutrition auto-links only 13 exact full retailer titles; 180 rows remain explicitly unresolved | Keep the earlier 163 broad exact/category/reference matches | A false negative asks for a label; a false positive silently logs the wrong calories for a different brand or variant |
| 2026-08-12 | Food identity is mandatory Brand + Item Name with optional Variant; all fields, serving conversions, and macros are editable | One free-text name plus fixed researched macros | Preserves product identity while giving KP complete control over personal corrections and custom foods |
| 2026-08-12 | New logs persist an immutable food snapshot | Resolve every historical log from the latest catalogue record | A later pack-size, conversion, name, or macro edit must never reinterpret the amount or totals originally logged |
| 2026-08-12 | Weight monitoring lives as a compact card under Track · Today | Add a third top-level health/measurements area | Keeps the two-area information architecture while making weigh-ins and the trend easy to reach |
| 2026-08-13 | Creating a food mints a fresh `custom-` id; editing a researched food forks a personal copy | Save personal edits back onto the selected food's id | Reusing the id silently replaced a researched entry: editing Nandini milk into a new food destroyed Nandini milk for every future log |
| 2026-08-13 | Timeline edit and remove address the stored entry, not the display row | Use the visible index directly | Unresolvable entries are dropped from the rendered list, so display position and storage position drift apart and the wrong entry is hit |
| 2026-08-13 | Food rows show a hot-linked photo with a drawn category icon fallback | Letter avatars, or downloading images into the repo | A letter is not recognisable at a glance, and this repo is public, so vendoring retailer imagery would be redistribution |
| 2026-08-13 | Kept `conversions` as the single way to express portions; the parallel `servings` model was discarded | Ship both a serving list and a unit conversion list | Two ways to say "400 g tub" would drift apart; conversions already cover packs, pieces and volumes |
| 2026-08-13 | Kept schema 2 multi-day storage; the parallel single-day v3 schema was discarded | Port the newer-looking schema | v3 held one day, so adopting it would have re-introduced the midnight diary wipe that schema 2 exists to fix |
| 2026-08-14 | Single Items distinguish **Packaged Food**, **Open Ingredient**, and **Ordered Food**; only prepared meals ordered online (such as Subway) are Ordered Food | Classify every online purchase as Ordered Food, or call the category Exact / Branded Food | Classification follows what the food is, not its purchase channel: Nandini milk remains Packaged Food even when bought through Instamart, while an ordered meal is kept as one atomic nutrition item because its ingredient breakdown is not known |
| 2026-08-14 | A logged Meal appears as one named row in Today, expandable to reveal its constituent Single Items | Add every Meal component as a separate top-level diary row | One row preserves the quick, readable diary while expansion retains ingredient-level transparency and editing |
| 2026-08-14 | Changing a saved Meal while logging changes only that diary entry | Silently update the reusable Meal whenever a component changes | An unusual portion today must not alter the shortcut used tomorrow; changing the saved template requires a separate deliberate edit |
| 2026-08-21 | Exact cardIQ linking now covers 18 complete retailer titles; 175 remain unresolved | Match on product family, a nearby pack, or a different flavour to increase coverage | One-tap health logging requires Brand + Item + Variant/form + pack identity; a truthful missing link is safer than a plausible false match |
| 2026-08-21 | A nutrient omitted from an exact product panel is displayed as “not declared” | Store and present the omitted field as a real zero | An absent declaration is not evidence that the food contains none; calculations may retain a known subtotal while every user-facing view preserves the uncertainty |
| 2026-08-21 | An uncertain or mismatched food image falls back to a category icon; source edits target the parsed TypeScript object and preserve existing photos by default | Fill every card from free-text image search or use regex to patch source records | The earlier automation crossed object boundaries and produced believable but wrong food photos; structured, object-local edits and explicit replacement are required |
| 2026-08-21 | Backup import reserves all current-data capacity first and reports additions, collisions, and overflow separately | Merge, sort, and slice the combined data to each storage cap | A supposedly additive import must never evict a current diary day, food, Meal, or weight record, including after save-and-reload normalisation |
| 2026-08-21 | Ambiguous, duplicate, or conflicting products are removed or kept unresolved | Retain a generic record and attach the closest label/photo | Generic zero cola, duplicate Kinley, conflicting Epigamia Turbo, and collapsed monk-fruit formulations could silently misstate exact health data |

## §6 Current State

As of 2026-08-21, Nourish has 123 researched foods. Every record has a unique stable identity, a positive serving basis, finite non-negative nutrition, and an HTTPS evidence source. Exact packaged products preserve brand, variant/form, and pack conversions. Calories remain cross-checked against their own macros. Bambino Plain Long Cut Vermicelli explicitly records that fibre was not declared; item, logger, diary, History, and Trends no longer present that omission as a measured zero.

The current local cardIQ snapshot contains 193 food rows. Exactly 18 complete purchase titles auto-link to a compatible catalogue record; 175 remain disabled and are generated into `data/UNMATCHED_CARDIQ_FOODS.md` from the matcher itself. Near sizes, different flavours, missing pack information, and generic product-family names remain unresolved. High-risk corrections include 24 Mantra Kabuli Chana at 908 g / 2 lb, the current 400 g Amul High Protein Paneer tin, exact Coca-Cola SKUs, and removal of ambiguous or duplicate cola, Kinley, Epigamia, and monk-fruit records.

Photo coverage is 54 exact or visually accepted images across 123 foods. The other 69 cards use the truthful drawn icon fallback. Free-text Commons search and automatic retailer scraping are retired fail-closed. The remaining generic Wikipedia allow-list emits review candidates only. `scripts/apply-food-photos.mjs` parses TypeScript, edits only the uniquely identified catalogue object, validates HTTPS URLs, rejects duplicate IDs, writes atomically, and preserves existing photos unless `--replace-existing` is supplied.

As of 2026-08-23 the diary is stored in **SQLite on the machine hosting the app** (`~/Library/Application Support/Nourish/nourish.db`, override `NOURISH_DB_PATH`), deliberately outside the repository so `npm run release` and `npm test` cannot touch it. The browser copy remains the working copy: the app still runs and logs with no network, and the two reconcile automatically. Verified by clearing browser storage entirely and reloading — the diary, targets and weights all returned from the database.

Each person has a completely separate diary, targets and weigh-ins. The first profile keeps the original localStorage keys, so the existing diary became KP's without a migration. Every save keeps the last 50 versions per profile server-side, so even "Delete everything" is recoverable. There is no authentication: tailnet membership is the boundary, and profiles separate diaries without locking them.

Everything KP creates can now be deleted — saved Meals, foods he added, weigh-ins, individual entries on past days, whole past days, and a full reset. Small deletes are immediate with a 10-second Undo; whole-day and delete-everything require confirmation. Deletions are recorded, so restoring an older backup cannot resurrect them, and the restore reports what it held back.

Diary days, targets, custom foods, reusable Meals, weights, Plan selections, immutable log snapshots, and Meal component snapshots survive reload. Export/import is additive and current-data-first: current records win collisions and keep their reserved capacity; imports fill free slots only; additions, conflicts, records held back as deleted, and rejected overflow are reported separately. Invalid or future diary dates are rejected.

The 2026-08-21 full-repository lead review passed the production build, lint, dependency audit, and all 115 automated checks, including failure injection. New boundary tests prove that photo edits cannot cross object boundaries and that a full backup import cannot evict current data. The same new tests were run against the previous code and failed there. No deployment, service restart, commit, staging, or push was performed in this audit.

### §6.1 Session state — 2026-08-30 (READ THIS FIRST if you are picking up)

**Shipped, live, and verified**

`bb9f726` fixed the bug that made Log Food dead on every real device. `crypto.randomUUID()`
exists only in a browser **secure context** — HTTPS, or the special-cased `localhost`.
Nourish is served over plain HTTP on a private Tailscale IP by design, so every real
device (phone, laptop via the `nourish` alias, the Mac Mini itself) loaded an *insecure*
context where `randomUUID` is silently `undefined`. Opening Log Food called it during
render with no error boundary above it, so React unmounted the whole tree to a blank page.
It survived weeks of testing because everything was only ever tested on `localhost`, the
one origin exempt from that rule. Pulled, released and confirmed working on the Mac Mini,
then confirmed by KP on both his iPhone and his laptop.

This also corrected a wrong diagnosis from earlier the same day: the preceding commit
(`fd65693`, tap-target CSS and iOS input zoom) was a real, separate fix, but it was **not**
what made the buttons dead, and was wrongly declared as such after being tested only on
localhost.

**Work in progress, committed but NOT yet pushed or deployed**

All of the below is one commit on top of `bb9f726`. The full suite (196 checks) and lint
are green, but see the explicit unverified list at the end — do not describe this as done.

1. *The bug class is now structurally shut.* `app/ids.ts` is the single home for id
   generation, built on `crypto.getRandomValues` (no secure-context restriction).
   `tests/insecure-context.test.ts` proves the helpers work with `randomUUID` removed and
   with `crypto` absent entirely, and scans all client source for **any** secure-context-only
   API (`crypto.subtle`, `navigator.clipboard`, `mediaDevices`, `geolocation`, …). Failure
   injection confirmed: 3 of its 5 tests fail against the old code.
2. *An error boundary.* `AppErrorBoundary` in `app/page.tsx` wraps the app. Its absence is
   what turned a small bug into a total blank-screen outage. It states plainly that logged
   food is safe and offers a reload.
3. *Photo confirmation.* `PhotoAttachControl` now shows "✓ Photo saved to the Mac Mini ·
   removed automatically after 30 days" on success, and on failure clears the preview and
   names the reason. Previously the local preview appeared instantly whether or not the
   upload landed, so the screen looked identical either way.
4. *Photos for a food KP adds himself.* Pasting an `https://` URL used to be the only
   option, which is unusable on the phone where items actually get added. New
   `FoodPhotoField` offers the camera first, link second.
   - Stored server-side in a **separate `food_photos` table** with its own
     `/api/nourish/diary/:profile/food/:foodId/photo` routes. Deliberately not `log_photos`:
     a meal photo is evidence that ages out after 30 days, a food's picture is catalogue
     data that must last as long as the food. Sharing one table would let the sweep silently
     strip pictures off items added months ago — regression-tested, failure-injection proven.
   - `isSafeImageUrl` now also accepts same-origin `/api/nourish/…` paths, since these
     photos have no scheme or host. Traversal and `//host` forms still rejected.

**Explicitly NOT verified — pick up here**

- `FoodPhotoField` has **never been exercised in a browser.** The session was stopped at
  exactly that step. Everything else in the list was driven live at
  `http://100.89.12.6:4318` (a genuinely insecure context, `isSecureContext === false`,
  `randomUUID === undefined`): Log Food opens, an item logs and persists to SQLite, and the
  log-photo success *and* offline-failure paths both behave correctly.
- `AppErrorBoundary` has not been triggered in a browser.
- The flow audit KP asked for is **barely started.** Only the Track → Log food path was
  walked. Plan, Meals, History, Trends, Purchases, Settings, backup/restore, weight, and
  profile switching were not examined at all.

**Findings raised but not yet acted on**

- *Catalogue thumbnails fetch from `bbassets.com` at render time* — 51 requests on opening
  the logger. This contradicts the project's own local-first rule ("no network at render
  time"). They are `loading="lazy"` and only fall back to the drawn icon on `error`, so a
  request that *hangs* (offline, or the Mini without internet) leaves blank white boxes
  indefinitely rather than falling back. Worth either caching images locally or showing the
  icon until the photo actually decodes.
- *Sharing with KP's wife and trainer was not assessed.* Profiles separate diaries but do
  not lock them; anyone on the tailnet can open any profile. That is recorded below as a
  deliberate open item, but it has not been re-examined against an actual multi-person use
  case, which is now the stated goal.

## §7 Known Issues and deferred scope

| Item | State | Resolution point |
|---|---|---|
| Permanent product name | Open | Confirm during design review |
| Exact calorie/macro target and personal dietary constraints | Sample and clearly labelled | Onboarding design before persistence |
| Nandini and Epigamia seed entries rely on current label mirrors | Needs exact-pack confirmation | Reconcile barcode/variant and pack photo during cardIQ import before promotion |
| 175 food purchase rows are deliberately not auto-linked | Open, enumerated | Exact Brand + Item + Variant/form + pack evidence was accepted for 18 titles. The complete unresolved list is generated in `data/UNMATCHED_CARDIQ_FOODS.md`; label photos, barcodes, or exact retailer IDs are the safe next input. |
| Food photos cover 54 of 123 foods; 69 use drawn icons | Open, deliberately | Add a photo only after exact brand/product/variant/pack or raw/cooked form is visually confirmed. Unsafe automatic retailer/free-text sourcing stays retired. |
| Catalogue thumbnails are fetched from `bbassets.com` while rendering | **Open, found 2026-08-30** | Contradicts the local-first rule that bans network at render time. 51 lazy image requests open with the logger; a hanging request never fires `error`, so the icon fallback never runs and the row shows a blank box. Cache the images locally, or show the drawn icon until the photo actually decodes. |
| Any render error blanks the entire app | **Fixed 2026-08-30, unverified in browser** | `AppErrorBoundary` now catches it and offers a reload. Its absence is what turned the `randomUUID` bug into a total outage. Needs a live trigger to confirm. |
| Main UI module and stylesheet are oversized | Architectural debt, worsening | `app/page.tsx` is now ~1,700 lines and `app/globals.css` ~1,000. Split by Plan/Track/product-area ownership before the next broad UI feature so one change does not require editing the whole screen. |
| Legacy meal and schema compatibility paths have no deletion date | Architectural debt | Measure whether old schema-1/single-meal data still exists, document a sunset condition, then remove the compatibility branch only after a migration/backup checkpoint. |
| Local canonical database | **Done 2026-08-23** | SQLite via `node:sqlite`, per-profile documents, 50-version server-side history, optimistic concurrency. Encrypted off-machine backup and a restore drill are still outstanding. |
| ~~Nourish's release/serve path is broken by a `cloudflare:workers` import~~ | **Not a real bug — corrected 2026-08-24** | Wrongly logged 2026-08-23: assumed (from `db/index.ts` containing `import { env } from "cloudflare:workers"`, and pattern-matching Watch Book's real bug in the same starter template) that `npm run serve` would crash, without testing it, and deployed the Mac Mini via a `pm2 run dev` workaround instead. It doesn't crash: `db/index.ts` is dead scaffolding from the vinext starter template — nothing in the real app imports it (only the unused `examples/d1/` template folder does), and `.openai/hosting.json` has `"d1": null, "r2": null`. Confirmed by actually running `npm run release` locally on the Mac that already had `com.kanwar.nourish` installed (2026-08-14) — it worked cleanly. Corrected same day: removed the Mac Mini's `pm2` workaround, installed `ops/com.kanwar.nourish.plist` there via `launchctl bootstrap`, ran `npm run release` for real. Live and verified at `http://100.81.29.11:4317`. |
| No authentication on the diary API | Open, by design for now | Tailnet membership is the only boundary; anyone on it can open any profile. A PIN was offered and not requested. |
| Watch Book has no assigned port | Open | 4400 proposed in the architecture doc; nothing depends on it yet. |
| Fullness score is an estimate, not a measurement | By design, labelled "est." | Revisit if a measured satiety source with real Indian coverage becomes available |
| `basis` field on `NutritionItem` is declared but never populated | Open | SPEC §4.1 wants label calories kept alongside a 4/4/9 comparison; the field exists but nothing writes it |
| Plan · Items cannot search imported purchases | Open | Items searches only the seed catalogue; the "Ordered" chip shows 3 entries rather than KP's real purchases |
| Recipe photography and curated source catalogue | Deferred | After interaction/design approval |
| Exact product nutrition for unmatched cardIQ foods | In progress | Reconcile the exact pack label/retailer ID before enabling one-tap logging; do not reduce the queue with near-matches |
| Amazon Now channel identification | Known ambiguity | Secondary evidence + review queue |
| Micronutrient targets and medical conditions | Deferred | Separate reviewed scope; never infer silently |
| Native barcode/photo/voice logging | Later enhancement | Only after fast text/recent logging proves solid |
| Apple Health write/read integration | Later enhancement | After the local canonical log is stable |

## §8 Privacy, safety, and reliability

- Single-user, private-by-default; remote access only over KP’s private network.
- No raw order export, address, payment, or retailer session secret is committed to Git.
- Secrets remain server-side and outside the repository.
- Raw personal imports and the SQLite database live in ignored private-data paths.
- Daily encrypted backup plus periodic restore test; a backup without a restore test is not trusted.
- All imports are idempotent and create an audit report with counts and unresolved rows.
- Nutrition suggestions are informational. Allergies and clinician-directed restrictions are hard constraints requiring explicit setup.
- Estimated nutrition is visibly labelled and editable.

## §9 Build phases and handoff

### Phase 0 — Product, design system, and researched seed catalogue (current)

- Complete information architecture, visual system, responsive behaviour, researched Items/Meals, and quantity-aware logging interactions.
- Review every Plan and Track subsection with KP.
- Freeze navigation, primary workflows, terminology, and design tokens.

**Exit gate:** KP approves the end-to-end prototype and any changes are incorporated.

### Phase 1 — Local foundation

- Introduce the local database, migrations, audit log, and safe backups.
- Build canonical foods, servings, recipes, recipe versions, and food-log records.
- Implement exact macro/energy calculations and provenance.

**Exit gate:** logging, edits, reloads, day totals, and backup/restore agree end-to-end.

### Phase 2 — Tracking loop

- Productionise quick add, search, repeated meals, custom labels, history editing, and trends.
- Add incomplete-day semantics and export.

**Exit gate:** KP can use Track daily for two weeks without data repair.

### Phase 3 — Planning loop

- Productionise recipe library, Meal Studio optimisation, swapping/locking, week planning, and groceries.
- Add preference learning only from explicit likes/dislikes and accepted swaps.

**Exit gate:** generated servings are practical and target tolerances are transparent.

### Phase 4 — Personal purchase catalogue

- Add the narrow cardIQ export/import contract.
- Import the past year, normalise items, enrich exact products, and resolve the review queue.
- Surface recent purchases in Plan and Track.

**Exit gate:** every promoted product has exact identity, serving, provenance, and a reproducible match.

### Phase 5 — Curated discovery

- Build the trusted-source registry and Indian ingredient/recipe curation workflow.
- Add seasonal, regional, time, equipment, and availability filters.

**Exit gate:** discovery recommends useful variety without copying uncertain nutrition blindly.

### Phase 6 — Always-on Mac Mini

- Run the app as a supervised service on the Mac Mini.
- Add private-network access, health checks, restart policy, encrypted backup, restore drill, and update runbook.

**Exit gate:** service survives restart, private access works, and a fresh restore reproduces totals.

### Handoff — as of 2026-08-23

**Where things stand.** Phase 1's local canonical database is built: SQLite via
`node:sqlite` (no new dependencies), one JSON document per person with a revision
counter, 50-version history per profile, WAL + `synchronous=FULL`. The client syncs
local-first. Everything KP creates can be deleted, with tombstones so a restore
cannot resurrect it. 171 tests green, lint clean.

**Nothing has ever run on the Mac Mini.** It was offline this whole session
(`tailscale status`: last seen 34 days ago). Phase 6 is the next real step and needs
KP physically there.

**Next session, in order:**
1. KP powers on the Mini, disables sleep, installs Tailscale, enables MagicDNS, and
   shares the `mac-mini` node with his wife. These need his logins; they are steps 1–5
   of the architecture doc.
2. Build the fleet: Caddy front door on port 80, one launchd service per app, a shared
   port registry in AI HQ, and the launcher page. Port map: Nourish 4317 (front door)
   → vinext 4316 internal, cardIQ 3128, Wealth 8000, alug 4173, Watch Book 4400 proposed.
3. Publish a Nourish release on the Mini and confirm the diary API answers there —
   the front door has only been proven on this MacBook.

**Read first:** `AI HQ/summaries/Nourish/diary-database-and-sync.md` — it records why
D1 was rejected, why sync and restore use different merge rules, and the profile-switch
bug that wrote one person's diary into another's.

**Watch out for:** `app/page.tsx` is ~1,700 lines and genuinely needs splitting before
the next broad UI feature. The diary API has no authentication by design.

**Architecture doc:** artifact `https://claude.ai/code/artifact/1f20befd-35f2-4742-b16a-992b73ed0795`
("Two Homes for Your Apps"), also exported as a 7-page PDF for KP.

### Current handoff

KP can log a real day using Packaged Food, Open Ingredients, Ordered Food, or reusable Meals; use grams/ml, natural counts, exact pack fractions, and serving conversions; and trust immutable snapshots to preserve what was entered. An omitted fibre declaration remains visibly unknown, and an uncertain purchase or photo remains unresolved rather than borrowing a nearby product. Backup import preserves every current record at all caps and tells KP what was added, conflicted, or could not fit.

The 2026-08-21 source tree passes the production build, lint, `npm audit --omit=dev` with zero known production vulnerabilities, and all 115 automated checks. The full test command was re-run and recorded through claim-gate. No deployment or Git publishing action occurred, and this audit did not inspect or alter the currently running launchd service. The pre-existing `.claude/CLAUDE.md` working-tree change belongs to KP and was left untouched.

Worth doing next, in order:

1. **Resolve purchases only from exact evidence.** Work down `data/UNMATCHED_CARDIQ_FOODS.md` with physical pack photos, barcodes, or exact retailer pages. Never restore category/reference auto-matching just to shrink the queue.
2. **Split the large UI ownership boundaries.** Extract Plan, Track, logger, and their styles before another broad UI feature; preserve behaviour with the current 115-check suite.
3. **Add the backed-up local database.** Move from a browser-profile safety net to Mac Mini persistence with encrypted backup and a restore drill.
4. **Set personal targets.** Today remains labelled Placeholder until KP supplies calorie/macro targets.

The next foundation phase remains backed-up local persistence and exact product reconciliation. cardIQ should remain connected only through the documented narrow import contract, without payment or address data.

## §10 Deployment

Target deployment is the always-on Mac Mini, not a public cloud product. The named service is `com.kanwar.nourish` and its dedicated port is **4317**. The service never selects a fallback port: if 4317 is already occupied, it exits with a clear error so the conflicting application can be fixed.

- Application: `launchd` service using `ops/com.kanwar.nourish.plist`, with `RunAtLoad`, restart after failure, and a 10-second restart throttle.
- Address: `http://localhost:4317` on each Mac. The shared launcher pulls the latest public GitHub `main` checkout before opening the local app.
- Database: local SQLite in a private ignored directory; WAL mode and foreign keys enabled.
- Access: private network/Tailscale only, with no public ingress.
- Backups: encrypted, versioned daily snapshots with retention and a scheduled restore test.
- Monitoring: health endpoint, process restart, disk-space check, backup-age alert, and clear plain-English status.
- Updates: tested locally, full suite green, backup recorded, then controlled restart. Git push alone is not a deploy.

### §10.1 Release snapshots — the live app never serves `dist/`

Adopted 2026-08-14 after the running service spent a day serving a page whose
JavaScript had been deleted underneath it. The page rendered and nothing was
clickable; `npm run health` reported green throughout.

Root cause: `npm test` begins with `npm run build`, and every build rewrites
`dist/` with freshly hashed filenames and deletes the previous ones. While the
service served `dist/` directly, **running the test suite silently broke the
live app**. `launchd`'s `KeepAlive` never noticed, because the process had not
crashed — it was serving a stale in-memory page quite happily.

The service now serves `releases/current`, a frozen snapshot that only
`npm run release` ever changes. Builds and tests write to `dist/`, which the
running app no longer reads. Verified by deleting `dist/` outright while the
app stayed healthy.

| Command | Purpose |
|---|---|
| `npm run release` | The only sanctioned deploy: build → snapshot → swap → restart → verify → auto-rollback on failure. `-- --no-build` publishes the current `dist/`. |
| `npm run serve` | What `launchd` runs. Serves `releases/current`; refuses to start if no release exists. |
| `npm run health` | Fetches the page, then every asset it names (plus one level of lazy chunks). Missing or empty file = red. |

- `releases/` is **gitignored** — snapshots contain the gitignored cardIQ import
  (invariant 5).
- Snapshots share `node_modules` with the repo by symlink; only `dist/`,
  `package.json`, `next.config.ts` and `.env*` are copied.
- The five most recent releases are retained so rollback is always possible.
- Rollback is automatic and drill-tested: publishing a deliberately broken
  release restored the previous one without intervention.
- `npm run health` must never be weakened back into a bare reachability check.
  Its failure-injection tests live in `tests/health-check.test.mjs` (TEST-12);
  the old `curl / >/dev/null` check passes the very test that reproduces this
  bug.

**Operational state at 2026-08-12 wrap-up:** the merged production build and 66 automated checks plus lint passed. Port 4317 was already occupied by an older Nourish process; browser inspection reached it but reported a stale hashed client asset. No restart was performed because KP authorised merge/push/wrap-up, not deployment.

**Operational state at 2026-08-14:** the stale-asset failure above recurred and was diagnosed to root cause, then removed structurally by §10.1 rather than by another restart. The `com.kanwar.nourish` LaunchAgent was reinstalled to run `npm run serve`, 108 automated checks plus lint passed, and the live app was confirmed interactive tab-by-tab in a real browser.

**Operational state at 2026-08-21:** the source tree passed 115 automated checks, lint, the production build, and a production dependency audit with zero known vulnerabilities. This lead review did not deploy, restart, or inspect the live `com.kanwar.nourish` service, so the 2026-08-14 live-service observation remains the latest deployment evidence.

Runbook once the Mac Mini is online: run the shared `nourish` launcher once to clone/pull GitHub `main`, then copy the checked-in LaunchAgent into `~/Library/LaunchAgents`, bootstrap it, and kickstart it. Terminal commands `nourish` and `health` are defined in the shared iCloud aliases file; on every synced Mac they pull the latest `main`, then open the local fixed-port copy. The Mac Mini was offline when this configuration was prepared on 2026-08-09, so the final always-on installation remains pending.
