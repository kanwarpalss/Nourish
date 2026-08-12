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
- Natural counts and exact pack conversions support entries such as four eggs, half a carton, or 100 ml without changing the underlying nutrition evidence.
- Multi-ingredient combinations can be assembled, named, saved, and logged as one reusable personal food while retaining each measured ingredient in the description.
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
- Single-item and combination logging with live calorie/protein/carbohydrate/fat/fibre recalculation before logging.
- Editable Brand, Item Name, optional Variant, nutrition basis, macros, and an optional natural-unit conversion such as one pack = 1,000 ml.
- History day selection and responsive detail.
- Trend range switching.
- A compact real body-weight logger and elapsed-time trend chart in Track Today.
- The local purchase catalogue with exact-match/review presentation; unresolved rows never receive look-alike nutrition.

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

- mandatory brand and item name, optional variant, package size, and optional barcode/retailer identifiers;
- serving definitions in grams/millilitres and natural Indian units where useful (roti, katori, glass, piece, tablespoon);
- calories, protein, carbohydrate, fat, fibre, sugar, sodium, and optional micronutrients;
- field-level source, source date, confidence, and evidence URL/image reference;
- raw-versus-cooked state and edible portion;
- aliases and a link to any retailer order line that matched it.

Search ranking: exact personal favourite → recent purchase → repeated meal → exact catalogue match → generic reference food → estimated result.

Brand, item name, variant, serving basis/unit, calories, protein, carbohydrate, fat, and fibre are all user-editable. Researched or imported values are pre-filled first; a personal edit is labelled as such and becomes the future default without rewriting the identity or nutrition snapshot stored in an older food log.

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
- switch between evidence-backed weight/volume and explicit natural-unit conversions such as piece or pack, including fractions;
- assemble measured ingredients into a named reusable combination, for example four egg whites plus 5 ml oil;
- see the exact quantity and unit in both the final add action and the logged timeline;
- rename a food or edit its brand, item name, optional variant, serving basis, calories, protein, carbohydrate, fat, and fibre;
- quick-add only calories/macros when detail is unavailable;
- create a custom food from a package label.

Every log records event time, meal slot, food/recipe version, serving quantity, grams, calculated nutrition, entry method, and optional note. Editing a food later does not rewrite history.

### 4.6 Trends

- Today shows eaten, target, remaining, macros, meal timeline, and one prioritised suggestion.
- History provides date-level review and correction.
- Weekly/monthly trends use averages, target-range days, and macro consistency—not streak shame.
- Missing or partial days are labelled; they are not treated as zero intake.
- Track includes a compact, date-aware body-weight log. A second entry on the same date corrects that date rather than duplicating it, and the real saved entries can expand into an elapsed-time trend chart.
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
| 2026-08-11 | Personal food edits are versioned defaults while food logs retain snapshots | Resolve every old log against the latest mutable food record | Renaming or correcting macros must not silently rewrite what was recorded earlier |
| 2026-08-11 | Weight tracking lives as a compact expandable card in Track Today | Add a third top-level area or a large dedicated dashboard | Keeps the two-area navigation intact while making weigh-ins and the real trend easy to reach |
| 2026-08-12 | Purchase nutrition auto-links only when the normalised retailer title equals one reviewed exact title | Accept substring, token, generic-ingredient, flavour-word, or similar-product matches | Pack sizes, freebies, multipacks, flavours, and formulations can share words while having different nutrition; an unresolved value is safer than a plausible wrong one |
| 2026-08-12 | Logging units are explicit conversions layered over one nutrition basis | Store independent macros for “pack”, “piece”, ml, and g views | One evidence-backed basis plus reviewed conversions keeps 0.5 pack, four eggs, and 100 ml mathematically consistent |
| 2026-08-12 | A saved combination is a personal one-serving food built from measured ingredient snapshots | Ask KP to manually total an omelette or repeatedly log every ingredient | Combination logging stays quick while oil and other easy-to-miss ingredients remain explicit |

## §6 Current State

As of 2026-08-12, the repository lives at `/Users/kanwar/Code/Nourish`. Plan is split into Items and Meals. The seed catalogue contains 64 researched products/ingredients and 10 original meals recalculated from structured, weighed ingredient records. Source strength and links are visible; the evidence register lives in `data/NUTRITION_SOURCES.md`. Track has the approved Today/History/Trends/Purchases structure plus a quantity-first logger with live nutrition recalculation. The add action and timeline show the exact quantity/unit at high contrast. Every food exposes editable Brand, Item Name, optional Variant, serving basis/unit, calories, protein, carbohydrate, fat, fibre, and an optional natural-unit conversion; those personal defaults persist while each diary entry retains its own snapshot. Foods can be logged by weight, volume, piece, pack, scoop, or serving where an explicit conversion exists, and measured ingredients can be saved and logged as a named personal combination. Today starts at zero, totals only KP's logged entries, and shows a Bangalore-local greeting and date. Logs are date-scoped, with a rollover guard preventing a prior day's diary from being saved into the next Bangalore day.

The local cardIQ importer reads the last year of deduplicated orders and writes an ignored snapshot to `public/cardiq-food-import.json`. Runtime sanitation removes 16 non-food rows and re-evaluates every stored match, so old guesses cannot linger. Of 193 retained food purchase rows, 13 exactly equal reviewed retailer titles and are nutrition-ready; 180 remain deliberately unlinked pending exact identity and compatible label evidence. The complete unresolved list lives in `data/UNMATCHED_CARDIQ_FOODS.md`. Food logs, personal food edits, saved combinations, weight entries, and Plan selections survive refresh in the current browser profile; malformed or mathematically inconsistent snapshots are isolated and rejected without discarding unrelated valid data. Track Today includes a compact real weight log with same-date correction and an expandable elapsed-time chart. Historical food Track data, targets, food charts, insights, and unlogged meal ideas are still preview data and are explicitly labelled Sample. This is intentionally browser-local persistence, not the backed-up local database planned for Phase 1. The working product name Nourish is not yet approved as permanent.

## §7 Known Issues and deferred scope

| Item | State | Resolution point |
|---|---|---|
| Permanent product name | Open | Confirm during design review |
| Exact calorie/macro target and personal dietary constraints | Sample and clearly labelled | Onboarding design before persistence |
| Nandini and Epigamia seed entries rely on current label mirrors | Needs exact-pack confirmation | Reconcile barcode/variant and pack photo during cardIQ import before promotion |
| Starter dependency audit reports four high-severity advisories | Open | Upgrade the core framework stack and rerun the audit before private-network access or deployment |
| Recipe photography and curated source catalogue | Deferred | After interaction/design approval |
| Exact product nutrition for 180 unmatched cardIQ purchase rows | Needs exact identity + pack evidence | Work through `data/UNMATCHED_CARDIQ_FOODS.md`; reconcile retailer ID/barcode and current pack photo before enabling one-tap logging |
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

KP can now test Today with food actually eaten: the diary starts empty; live quantities recalculate nutrition; the exact volume, weight, count, or pack fraction is prominent before and after adding; and any food identity, serving basis, macro, or alternate-unit conversion can be corrected and saved to My Foods. Combination mode can turn measured ingredients such as four egg whites plus 5 ml oil into a named reusable food. Older logged snapshots remain unchanged by later food edits, and stored alternate-unit snapshots are accepted only when their macros agree with their saved basis and conversion. The compact Body Weight card accepts dated weigh-ins, corrects a repeated date, and expands into a real trend chart. Refresh restores same-day food logs, personal food defaults, saved combinations, and weight history; the next Bangalore day starts with an empty food diary. Only 13 reviewed cardIQ retailer titles currently auto-link; all other purchase rows are visible in the unresolved audit rather than receiving generic nutrition. History, food Trends, targets, insights, and unlogged meal ideas remain Sample previews. The next build phase is backed-up local persistence and exact product reconciliation; cardIQ should remain connected only through the documented narrow import contract, without importing payment or address data.

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
