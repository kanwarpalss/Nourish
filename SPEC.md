# Health — Product Specification

> **Working product name:** Nourish. The repository and canonical project name remain **Health** until KP approves a permanent name.
>
> **Status:** Functional browser-local prototype with a read-only cardIQ food snapshot. Plan uses a researched seed catalogue and ingredient-calculated meals; Track now has a real multi-day diary, editable targets, history/trends, and weight monitoring. A backed-up local database is still pending.

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

## §6 Current State

As of 2026-08-14 the source tree implements the approved Log Food simplification. The logger now has only Single Items and Meals. Packaged groceries such as Nandini remain Packaged Food even when purchased online; Ordered Food is reserved for prepared online meals such as Subway; Open Ingredients need no invented brand. The no-result create action renders independently of search selection, and opening the logger freezes background scrolling while the modal remains internally scrollable. Saved Meals retain item snapshots, log as one expandable row, and accept one-off component changes without modifying the reusable template. Built-in composites and calculated recipes are presented through the same Meal model, while legacy aggregate meal logs remain readable. A temporary production run on port 4318 exercised the complete Subway no-result creation, modal scrolling, two-item Meal creation, one-row expansion, today-only quantity adjustment, and refresh-persistence journeys with no browser console or framework-overlay errors; the full build and 93-check suite pass. After commit `c35f3de` reached `origin/main`, the stale detached process on port 4317 was replaced by launchd `com.kanwar.nourish`; the live local health response is HTTP 200.

Food photos are sourced at build time from Wikipedia article lead images (`scripts/source-wikipedia-photos.mjs`) and retailer pack shots (`scripts/source-product-photos.mjs`), then hot-linked. 61 of 124 foods have one; the rest fall back to a drawn food-category icon. Coverage is deliberately partial: every candidate was reviewed by eye and anything questionable was rejected, because a food showing the wrong picture is worse than one showing an icon.

As of 2026-08-13 the parallel logging branch has been reconciled into `main`, keeping the stronger half of each side. From `main`: multi-day storage, day history and trends, targets, per-entry overrides, composite dishes, and `conversions` — the one model for logging a food by pack, piece or volume while its base panel stays the source of truth. Ported on top: a **Create a new food** path that starts from a blank form and asks whether to keep the food in My Foods, **fork-on-edit** so correcting a researched food produces a personal copy instead of overwriting the reference, **remove with a 10-second Undo** on Today's timeline, and **photo thumbnails** with a drawn food-category icon fallback. Two things were deliberately discarded rather than merged: a parallel `servings` model (duplicated `conversions`) and a single-day storage schema (would have re-introduced the midnight diary wipe).

As of 2026-08-12, all completed Nourish work has been reconciled on `main` in `/Users/kanwar/Code/Nourish`. Plan remains split into Items and Meals. The researched catalogue, 9 editable composite dishes, and 10 ingredient-calculated meals are intact, with source strength and links visible through `data/NUTRITION_SOURCES.md`. Track has the approved Today/History/Trends/Purchases structure, a real multi-day diary, editable personal targets, and a compact weight log/trend within Today. Today starts at zero, totals only KP's logged entries, and follows Bangalore-local date boundaries.

**The diary is now multi-day and real (fixed 2026-08-10).** Storage previously held exactly one day; on Bangalore-day rollover the app declined to restore yesterday's logs, then immediately autosaved the new empty day over the same key — the entire previous day's food log was destroyed every midnight. Storage is schema 2 now: every day is kept, capped at 400 (~13 months), and only today's slice is ever rewritten (`withDayLogs()`); schema-1 data migrates automatically. **History and Trends read this real diary, not sample data** — History lists only days actually logged with real per-day macros; Trends computes averages over logged days only (never calendar days, per §4.6) and says plainly when there is nothing to show rather than drawing a chart from nothing. Daily targets are KP's own, editable, and persisted, labelled "Placeholder" until set.

**Food identity and logging are now flexible without weakening evidence.** Commercial foods keep exact brand/restaurant identity; Open Ingredients use a generic reference identity without making KP type a fake brand. Variant, nutrition basis, alternate unit, and five macro fields can be edited. Personal Single Items and component-preserving Meals are stored in browser-local state. The logger supports weight, volume, count, exact pack fractions, and serving units where an exact conversion is known. New entries store immutable snapshots so history retains the displayed unit, conversion, evidence, totals, and—when applicable—the expandable Meal components originally logged.

**Purchase matching is deliberately exact.** The 2026-08-10 audit exposed dangerous substring/category false positives. The stricter 2026-08-12 rule now auto-links only **13** full retailer titles whose exact Brand + Item + Variant/pack has compatible researched nutrition. All **180** remaining food purchase rows stay unlinked and are enumerated in `data/UNMATCHED_CARDIQ_FOODS.md`; generic/reference foods remain searchable for a conscious manual choice but never auto-populate a branded purchase. Non-food classification and snapshot re-sanitisation still run in the app, so stale file matches cannot bypass the rule.

The seed catalogue now covers KP's real pantry: five milk grades, curd, paneer, tofu, cheese, dairy cream, whole wheat atta, rice, poha, vermicelli, breads, four dals, besan, dry and cooked chickpeas, and everyday produce. Composite dishes — chapati, chapati with ghee, chicken sabzi, paneer sabzi, dal tadka, aloo sabzi, mixed veg sabzi, egg bhurji, curd katori — prefill realistic component weights that are individually editable, and the edited weights are saved with the log entry. Adding a food keeps the logger open so a multi-item plate is one flow. Plan supports a calorie ceiling and protein window, plus an estimated 0–100 fullness score computed from protein, fibre and energy density.

The local cardIQ importer reads the last year of deduplicated orders and writes an ignored snapshot to `public/cardiq-food-import.json`; it warns rather than silently truncating at 1000 orders. Food logs, custom Single Items, saved Meals, targets, weights, the diary, and Plan selections survive refresh in the current browser profile; two earlier storage keys migrate into v3 and malformed data is rejected. The unlogged meal idea remains explicitly Sample. This is intentionally browser-local persistence, not the backed-up local database planned for Phase 1. The working product name Nourish is not yet approved as permanent.

## §7 Known Issues and deferred scope

| Item | State | Resolution point |
|---|---|---|
| Permanent product name | Open | Confirm during design review |
| Live app froze — page rendered, nothing clickable | Fixed 2026-08-14 | The service served `dist/`, which every build and test run rewrites with new asset hashes, deleting the files the running page named. Removed structurally by release snapshots (§10.1) plus an honest `npm run health`; regression-tested in `tests/health-check.test.mjs` |
| Exact calorie/macro target and personal dietary constraints | Sample and clearly labelled | Onboarding design before persistence |
| Nandini and Epigamia seed entries rely on current label mirrors | Needs exact-pack confirmation | Reconcile barcode/variant and pack photo during cardIQ import before promotion |
| Dependency audit: 2 high-severity advisories remain, down from 16 | Verified unreachable | `image-size`@2.0.2 (pinned exactly by every vinext release including its newest 1.0.0-beta.5 — there is no patched image-size release as of 2026-08-10) allows a DoS via malicious ICNS/JXL/HEIF parsing, reachable only through `@vercel/og` image generation. Confirmed by grep that Nourish's own code never calls it. Revisit when image-size publishes a fix. |
| 180 food purchase rows are deliberately not auto-linked | Open, enumerated | Exact Brand + Item + Variant/pack evidence was accepted for 13 titles. The complete unresolved list is `data/UNMATCHED_CARDIQ_FOODS.md`; label photos/retailer IDs are the safe next input. Similar brands, categories, and generic ingredients are not substituted. |
| Fullness score is an estimate, not a measurement | By design, labelled "est." | Revisit if a measured satiety source with real Indian coverage becomes available |
| `basis` field on `NutritionItem` is declared but never populated | Open | SPEC §4.1 wants label calories kept alongside a 4/4/9 comparison; the field exists but nothing writes it |
| Epigamia (9.4% off) and Amul buttermilk (6.5% off) label calories disagree with their own macros | Open | Reconcile against the physical pack; both remain marked Label mirror |
| Plan · Items cannot search imported purchases | Open | Items searches only the seed catalogue; the "Ordered" chip shows 3 entries rather than KP's real purchases |
| Recipe photography and curated source catalogue | Deferred | After interaction/design approval |
| Food photos cover 61 of 124 foods; the remaining 63 use drawn icons | Open, deliberately | Mostly Indian branded packs Wikipedia has no article for. Add via `scripts/source-product-photos.mjs` (retailer pack shots), one product page at a time |
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

### Current handoff

KP can log a real day using Packaged Food, Open Ingredients, Ordered Food, or reusable Meals; use grams/ml, natural counts, exact pack fractions, and serving conversions; and trust immutable snapshots to preserve what was entered. A Meal stays one expandable diary row and today-only quantity changes do not rewrite its saved template. The source build, 93 checks, lint, and the isolated browser journey are green; `main` is pushed and launchd `com.kanwar.nourish` now serves the current local build on port 4317 with a 200 health response. The diary survives Bangalore midnight, History/Trends use real logged days, and weight entries have their own optional trend. Dependency advisories remain at 2, both previously confirmed unpatchable upstream.

Worth doing next, in order:

1. **Live with the simplified logger for several days.** Exercise a zero-result Subway creation, 0.5-pack milk, an unbranded Open Ingredient, a saved egg-white-and-oil Meal, a today-only Meal quantity change, and weight corrections.
2. **Resolve purchases only from exact evidence.** Work down `data/UNMATCHED_CARDIQ_FOODS.md` with pack photos, barcodes, or exact retailer pages. Never restore category/reference auto-matching just to shrink the queue.
3. **Set personal targets.** Today remains labelled Placeholder until KP supplies calorie/macro targets.

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

Runbook once the Mac Mini is online: run the shared `nourish` launcher once to clone/pull GitHub `main`, then copy the checked-in LaunchAgent into `~/Library/LaunchAgents`, bootstrap it, and kickstart it. Terminal commands `nourish` and `health` are defined in the shared iCloud aliases file; on every synced Mac they pull the latest `main`, then open the local fixed-port copy. The Mac Mini was offline when this configuration was prepared on 2026-08-09, so the final always-on installation remains pending.
