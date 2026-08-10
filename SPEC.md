# Health — Product Specification

> **Working product name:** Nourish. The repository and canonical project name remain **Health** until KP approves a permanent name.
>
> **Status:** Functional research prototype with a local, read-only cardIQ food snapshot. Plan uses a researched seed catalogue and ingredient-calculated meals; Track’s historical timeline and targets remain preview data until the local database phase.

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
- Commonly ordered, product, ingredient, and meal tabs in Log Food.
- Quantity editing with live calorie/protein/carbohydrate/fat/fibre recalculation before logging.
- History day selection and responsive detail.
- Trend range switching.
- Purchase catalogue and match/review presentation, clearly labelled as dummy data.

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
| 2026-08-10 | Indian dairy grades and paneer map to legally standardised category references, marked Reference | Invent per-brand label values, or leave every brand unmatched | Toned, double-toned, skimmed and full cream have statutory fat/SNF minimums, so the grade is accurate for any brand; the pack still outranks it |
| 2026-08-10 | Everyday dishes are composites with prefilled, individually editable component weights | One fixed calorie figure per dish | A chapati is however much atta went into it and a sabzi is however much oil was used; a correctable default is more truthful than a fixed number |
| 2026-08-10 | Dry and cooked pulses are separate foods | One entry per pulse | A retail pack is dry; using the cooked figure understates a 500 g pack of moong dal more than threefold |
| 2026-08-10 | Adding a food keeps the logger open; editing an entry closes it | Close after every add | A real plate is several foods, so a multi-item meal should be one flow; an edit is finished when applied |
| 2026-08-10 | Fullness is computed from protein, fibre and energy density, labelled “est.” | Hand-assign satiety-index values per food | A computed score cannot drift from the macros it describes and self-corrects when a macro is fixed; hand-typed values have partial coverage and nothing to check them against |
| 2026-08-10 | Numeric meal badges are derived from the thresholds they advertise | Hand-typed tag strings | A typed badge silently contradicted the number beside it once an ingredient changed |
| 2026-08-10 | Published nutrition panels may be transcribed from the web, marked Label mirror | Only accept a panel photographed from the pack in hand | Refusing to look up a published panel is not caution, it is just a gap; the tier system already exists to record that a mirror is weaker than the pack |
| 2026-08-10 | A transcribed panel is rejected unless its macros agree with its stated energy | Trust the source and enter the number | Nutrition aggregators are user-contributed and disagree; the Yogabar figures were 13.6% self-inconsistent, so one of the two numbers was simply wrong |
| 2026-08-10 | The energy cross-check is enforced by the suite, with a tighter bound for packaged panels than raw foods | Leave it to reviewer judgement each time | A manufacturer's panel is their own arithmetic and should agree with itself; composition tables legitimately use food-specific factors |
| 2026-08-10 | The diary keeps every day, capped at 400, and only today's slice is ever rewritten | One day held inline, replaced on rollover | The single-day store destroyed the previous day at every Bangalore midnight, and made a truthful History impossible |
| 2026-08-10 | History and Trends read the stored diary; averages divide by logged days, not calendar days | Keep polished sample charts until the database phase | Dividing by calendar days invents a fast for every unlogged day, which SPEC 4.6 forbids; an app used for health must not draw a chart out of nothing |
| 2026-08-10 | Daily targets are KP's own, editable and persisted, labelled "placeholder" until set | A fixed 2,150 kcal sample target | Every number on Today is measured against the target, so a placeholder must never be mistaken for a decision |
| 2026-08-10 | A failed save raises a persistent banner, not a toast | Toast, or silence | If the diary has stopped being written, KP must keep seeing that until it is fixed |
| 2026-08-10 | Every interactive control is at least 44 px tall on mobile | Keep the desktop density on phones | Inline controls rendered 12–30 px tall; logging happens one-handed in a kitchen |

## §6 Current State

As of 2026-08-10, the repository lives at `/Users/kanwar/Code/Nourish`. Plan is split into Items and Meals. The seed catalogue contains **70** researched products/ingredients, **9 composite dishes**, and 10 original meals recalculated from structured, weighed ingredient records. Source strength and links are visible; the evidence register lives in `data/NUTRITION_SOURCES.md`, and all nine external source links were verified reachable on 2026-08-10. Track has the approved Today/History/Trends/Purchases structure plus a quantity-first logger with live nutrition recalculation. Today starts at zero, totals only KP's logged entries, and shows a Bangalore-local greeting and date. Logs are date-scoped so a prior day's diary is not restored as today's intake.

**Purchase matching was rebuilt on 2026-08-10.** The previous matcher used unanchored substring matching with no non-food guard and produced 12 materially wrong matches out of 43 — kids' toothpaste logged as a banana, cough syrup and baby moisture cream as rolled oats, cream-onion crisps as raw onion, oat beverages as dry oats. Instamart and BigBasket bypassed the non-food check entirely, so toilet cleaner, antiseptic, agarbatti and a paperback novel sat in the food catalogue. Matching is now whole-word wherever it assigns macros, applies a non-food blocklist to all stores, refuses to give a manufactured product its raw ingredient's nutrition, and resolves exact products on a separator-free name so "Nandini Good Life" and "Nandini GoodLife" agree. Of the same 209 imported items, 194 are food and **149 now carry macros, all manually reviewed**, against 35 correct before — covering 84% of KP's actual purchase events. Classification runs in the app at load, so improving the matcher needs no re-import.

The seed catalogue now covers KP's real pantry: five milk grades, curd, paneer, tofu, cheese, dairy cream, whole wheat atta, rice, poha, vermicelli, breads, four dals, besan, dry and cooked chickpeas, and everyday produce. Composite dishes — chapati, chapati with ghee, chicken sabzi, paneer sabzi, dal tadka, aloo sabzi, mixed veg sabzi, egg bhurji, curd katori — prefill realistic component weights that are individually editable, and the edited weights are saved with the log entry. Adding a food keeps the logger open so a multi-item plate is one flow. Plan supports a calorie ceiling and protein window, plus an estimated 0–100 fullness score computed from protein, fibre and energy density.

The local cardIQ importer reads the last year of deduplicated orders and writes an ignored snapshot to `public/cardiq-food-import.json`; it now warns rather than silently truncating at 1000 orders. Food logs and Plan selections survive refresh in the current browser profile; malformed stored entries are rejected during restore. Historical Track data, targets, charts, insights, and unlogged meal ideas are still preview data and are explicitly labelled Sample. This is intentionally browser-local persistence, not the backed-up local database planned for Phase 1. The working product name Nourish is not yet approved as permanent.

## §7 Known Issues and deferred scope

| Item | State | Resolution point |
|---|---|---|
| Permanent product name | Open | Confirm during design review |
| Exact calorie/macro target and personal dietary constraints | Sample and clearly labelled | Onboarding design before persistence |
| Nandini and Epigamia seed entries rely on current label mirrors | Needs exact-pack confirmation | Reconcile barcode/variant and pack photo during cardIQ import before promotion |
| Dependency audit: 2 high-severity advisories remain, down from 16 | Verified unreachable | `image-size`@2.0.2 (pinned exactly by every vinext release including its newest 1.0.0-beta.5 — there is no patched image-size release as of 2026-08-10) allows a DoS via malicious ICNS/JXL/HEIF parsing, reachable only through `@vercel/og` image generation. Confirmed by grep that Nourish's own code never calls it. Revisit when image-size publishes a fix. |
| 45 imported purchases still carry no macros | Open | Down from 97 to 45 across two research passes on 2026-08-10. What remains is mostly snacks, spices, and variants whose panel could not be verified (So Good Barista, Slurrp Farm cookies, Milky Mist SKYR, regular Coca-Cola). Needs the "create a custom food from a package label" flow in SPEC §4.5 |
| Fullness score is an estimate, not a measurement | By design, labelled "est." | Revisit if a measured satiety source with real Indian coverage becomes available |
| `basis` field on `NutritionItem` is declared but never populated | Open | SPEC §4.1 wants label calories kept alongside a 4/4/9 comparison; the field exists but nothing writes it |
| Epigamia (9.4% off) and Amul buttermilk (6.5% off) label calories disagree with their own macros | Open | Reconcile against the physical pack; both remain marked Label mirror |
| Plan · Items cannot search imported purchases | Open | Items searches only the seed catalogue; the "Ordered" chip shows 3 entries rather than KP's real purchases |
| Recipe photography and curated source catalogue | Deferred | After interaction/design approval |
| Exact product nutrition for unmatched cardIQ foods | In progress | Reconcile exact pack label before enabling one-tap logging |
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

KP can now test Today with food actually eaten: the diary starts empty, live quantities recalculate nutrition, refresh restores same-day logs, and the next Bangalore day starts separately. History, Trends, targets, insights, and unlogged meal ideas remain Sample previews.

Worth reviewing next session, in this order:

1. **Purchases** — confirm the 15 dropped items really are non-food and that nothing edible was lost, then spot-check a few of the 97 matched items against the packs in the kitchen.
2. **Log Food → Dishes** — check the prefilled component weights against how KP actually cooks. The chapati defaults to 30 g of atta and the sabzis to 8–10 g of oil; these are the numbers most worth correcting, and correcting them is the point.
3. **Plan · Meals** — try a calorie ceiling and protein window, and judge whether the estimated fullness ranking matches KP's own experience of which foods hold him.

The next build phase is backed-up local persistence, the package-label entry flow for the 112 purchases still without macros, and exact product reconciliation. cardIQ should remain connected only through the documented narrow import contract, without importing payment or address data.

## §10 Deployment

Target deployment is the always-on Mac Mini, not a public cloud product. The named service is `com.kanwar.nourish` and its dedicated port is **4317**. The service never selects a fallback port: if 4317 is already occupied, it exits with a clear error so the conflicting application can be fixed.

- Application: `launchd` service using `ops/com.kanwar.nourish.plist`, with `RunAtLoad`, restart after failure, and a 10-second restart throttle.
- Address: `http://localhost:4317` on each Mac. The shared launcher pulls the latest public GitHub `main` checkout before opening the local app.
- Database: local SQLite in a private ignored directory; WAL mode and foreign keys enabled.
- Access: private network/Tailscale only, with no public ingress.
- Backups: encrypted, versioned daily snapshots with retention and a scheduled restore test.
- Monitoring: health endpoint, process restart, disk-space check, backup-age alert, and clear plain-English status.
- Updates: tested locally, full suite green, backup recorded, then controlled restart.

Runbook once the Mac Mini is online: run the shared `nourish` launcher once to clone/pull GitHub `main`, then copy the checked-in LaunchAgent into `~/Library/LaunchAgents`, bootstrap it, and kickstart it. Terminal commands `nourish` and `health` are defined in the shared iCloud aliases file; on every synced Mac they pull the latest `main`, then open the local fixed-port copy. The Mac Mini was offline when this configuration was prepared on 2026-08-09, so the final always-on installation remains pending.
