# Nourish — Product Specification

> **Canonical product and repository name:** Nourish.
>
> **Status:** Always-on local-first application on the Mac Mini. Full Control food,
> Meal, photo, Plan, diary, delete/Undo and sync flows are released. Per-person calorie
> and macro targets, the visible weight trend, honest persistence status and retry-safe
> Mini sync are released at runtime commit `eb98c55`;
> the production address is `http://100.81.29.11:3902`. The researched catalogue
> contains 123 foods and 18 exact purchase-title matches. Authentication remains
> explicitly parked; unresolved product labels and encrypted off-machine
> backup/restore are the principal product inputs still outstanding.

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
- Dated body-weight logging with same-day correction, safe bounds, and a visible-by-default
  trend chart once two or more weigh-ins exist. The chart reports its date range and low/high
  values without requiring colour perception.
- Per-person calorie, protein, carbohydrate and fat targets that can be opened directly from
  Today, changed or reset at any time, and reconciled independently across devices.
- A persistent status banner that distinguishes “saved on the Mac Mini” from browser-only,
  saving, retrying and failed states; an unconfirmed write remains dirty and retries.
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
| 2026-09-02 | Delete/Undo is an ordered record decision, not only a tombstone | Merge the union of deleted ids forever | A newer restore must beat an older sync delete, while legacy deletion records still migrate safely |
| 2026-09-02 | An unresolved purchase opens a blank personal-item draft prefilled only with its exact purchased name | Disable it forever, or prefill plausible nutrition | A missing label must never become guessed macros, but it must not be a dead end for someone who has the pack in hand |
| 2026-09-02 | Copying a food or Meal always creates a new independent draft and never shares a managed food photo | Reuse the original identity or photo | Edits to a copy must not rewrite the original or let deletion of one item silently remove another item’s image |
| 2026-09-03 | The final mobile accessibility contract lives last in the stylesheet and wins the cascade | Rely on an earlier generic 44 px rule | Later feature rules had silently shrunk real controls to 29–42 px; one final contract plus 375/414 px browser geometry makes the user-facing rule observable |

## §6 Current State

As of 2026-08-21, Nourish has 123 researched foods. Every record has a unique stable identity, a positive serving basis, finite non-negative nutrition, and an HTTPS evidence source. Exact packaged products preserve brand, variant/form, and pack conversions. Calories remain cross-checked against their own macros. Bambino Plain Long Cut Vermicelli explicitly records that fibre was not declared; item, logger, diary, History, and Trends no longer present that omission as a measured zero.

The current local cardIQ snapshot contains 193 food rows. Exactly 18 complete purchase titles auto-link to a compatible catalogue record; 175 remain disabled and are generated into `data/UNMATCHED_CARDIQ_FOODS.md` from the matcher itself. Near sizes, different flavours, missing pack information, and generic product-family names remain unresolved. High-risk corrections include 24 Mantra Kabuli Chana at 908 g / 2 lb, the current 400 g Amul High Protein Paneer tin, exact Coca-Cola SKUs, and removal of ambiguous or duplicate cola, Kinley, Epigamia, and monk-fruit records.

Photo coverage is 54 exact or visually accepted images across 123 foods. The other 69 cards use the truthful drawn icon fallback. Free-text Commons search and automatic retailer scraping are retired fail-closed. The remaining generic Wikipedia allow-list emits review candidates only. `scripts/apply-food-photos.mjs` parses TypeScript, edits only the uniquely identified catalogue object, validates HTTPS URLs, rejects duplicate IDs, writes atomically, and preserves existing photos unless `--replace-existing` is supplied.

As of 2026-08-23 the diary is stored in **SQLite on the machine hosting the app** (`~/Library/Application Support/Nourish/nourish.db`, override `NOURISH_DB_PATH`), deliberately outside the repository so `npm run release` and `npm test` cannot touch it. The browser copy remains the working copy: the app still runs and logs with no network, and the two reconcile automatically. Verified by clearing browser storage entirely and reloading — the diary, targets and weights all returned from the database.

Each person has a completely separate diary, targets and weigh-ins. The first profile keeps the original localStorage keys, so the existing diary became KP's without a migration. Every save keeps the last 50 versions per profile server-side, so even "Delete everything" is recoverable. There is no authentication: tailnet membership is the boundary, and profiles separate diaries without locking them.

Everything KP creates can now be deleted — saved Meals, foods he added, weigh-ins, individual entries on past days, whole past days, and a full reset. Small deletes are immediate with a 10-second Undo; whole-day and delete-everything require confirmation. Deletions are recorded, so restoring an older backup cannot resurrect them, and the restore reports what it held back.

Diary days, targets, custom foods, reusable Meals, weights, Plan selections, immutable log snapshots, and Meal component snapshots survive reload. Export/import is additive and current-data-first: current records win collisions and keep their reserved capacity; imports fill free slots only; additions, conflicts, records held back as deleted, and rejected overflow are reported separately. Invalid or future diary dates are rejected.

The 2026-08-21 full-repository lead review passed the production build, lint, dependency audit, and all 115 automated checks, including failure injection. New boundary tests prove that photo edits cannot cross object boundaries and that a full backup import cannot evict current data. The same new tests were run against the previous code and failed there. No deployment, service restart, commit, staging, or push was performed in this audit.

### §6.1 Historical session state — 2026-08-30

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

**Resumption note — 2026-08-30 (working tree only; not committed, pushed, or deployed)**

The requested product/PM/UX audit was completed against a disposable SQLite database at
`http://100.89.12.6:4317`, including a phone-sized 390 px viewport and an insecure HTTP
context. Track → Log Food opened, a new custom item was logged, survived reload, and its
food photo persisted into the editor. Plan → Items and Meals, History, Trends, Purchases,
Settings, mobile navigation, and the honest empty states were each walked. No horizontal
overflow occurred at 390 px.

That audit produced four working-tree corrections:

1. Quick Add uses stable food ids rather than duplicate display names as React keys.
2. Food-photo URLs now retain their storage key through cache-busting, reject malformed or
   non-food routes without crashing, and are the only relative API image path accepted.
3. Food-photo replacement/removal is staged with the food edit: Cancel and backdrop-close
   remove only a temporary upload, while Save retires the old image after changing the food.
4. Settings no longer contradict a confirmed Mac Mini sync by calling every browser a
   separate unsynchronised diary.

The complete suite now has **198 checks** (49 HTTP/render/layout + 149 TypeScript), all
passed this turn; lint also passed. The temporary server used only the disposable database;
no user diary, live service, commit, push, or deployment was touched.

**Explicitly NOT verified — pick up here**

- `FoodPhotoField` was exercised through successful upload, persistence, and reload before
  its Cancel-safe staging refinement. The refined cancel/backdrop cleanup is regression-
  covered and built, but still needs one final browser interaction test.
- `AppErrorBoundary` has not been triggered in a browser.
- Backup restore requires a specific file-upload approval; full reset and delete controls
  require action-time deletion approval. They were intentionally not activated against any
  diary. Profile creation/switching and a completed Meal creation also remain to be walked
  manually, although their underlying flows are covered by the full suite.

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

**Historical continuation handoff — 2026-08-30 (superseded below)**

KP asked for the “ultimate” flexible experience: people must be able to add, modify,
copy, remove and undo foods, meals and photos without data loss or forced paths. The PM/UX
audit found that the earlier UI was broadly capable, but several destructive and creation
boundaries were not yet safe enough to call complete.

**Confirmed audit findings**

1. Deleting a personal food removed all matching Plan lines, but Undo restored only the
   food — silently losing the Plan choices.
2. Sync represented deletion as an unordered tombstone. A later Undo on device A could be
   overruled by the older tombstone still present on device B.
3. At the 500-food or 200-saved-Meal cap, delete → create another item → Undo could append
   then slice the collection, silently evicting an unrelated older item.
4. An unresolved cardIQ purchase said “Needs label” but was disabled, with no direct,
   pre-filled route to create the exact product from the purchased name. It must never guess
   nutrition, but it must give the user a way forward.
5. Plan’s custom-food creation discarded an alternate logging-unit conversion even though
   Track preserved it.
6. Copy controls for foods and saved Meals, a personal-items filter, and adding a component
   to a one-off Meal edit are still to be built. A copied managed food photo must not be
   shared with the original; copy with no managed photo unless a genuine independent copy is
   implemented.
7. Food-photo upload has further lifecycle boundaries to cover: cancel while an upload is
   still in flight, replace then cancel, and eventual safe cleanup after an un-Undone delete.

**Partial implementation currently in the working tree — NOT tested, committed, pushed,
or deployed**

- `app/local-nutrition-state.ts` now has an in-progress `removalDecisions` model recording
  the latest `{ removed, at }` decision per record. It is intended to let a later Undo win
  over an earlier synced deletion while retaining legacy `removed` arrays for migration.
  `removeRecord()` now captures each removed custom-food Plan entry and its index;
  `restoreRecord()` restores them and refuses a capacity restore rather than slicing an
  unrelated item. `canRestoreRecord()` was added for the UI to explain a full-list Undo.
- `app/logging-session.ts` now permits `CustomFoodDraft.conversions` and
  `createCustomFood()` deep-copies that conversion, so Plan and Track can preserve the same
  alternate-unit setup.
- `tests/removal.test.ts` has new regression cases for Plan restoration, delete/Undo sync
  ordering, and capacity-safe Undo. These were written but have **not** completed a test run.
- The full `npm test` command was started after these edits but deliberately interrupted by
  KP after about six seconds. There is no current green-build evidence for this partial work.

**Next agent: required order**

1. Run the build/type suite immediately and repair the in-progress deletion-decision model
   before treating it as safe. Preserve compatibility with older saved bytes and the rule
   that backup restore is additive while sync carries deliberate deletes/restores.
2. Wire `canRestoreRecord()` into the Undo toast: when storage is full, keep Undo available
   and say that nothing was restored until the user makes room; never evict a record.
3. Add the unresolved-Purchase “Add details” path, pre-filled only with the bought name and
   no invented nutrition; save it into personal Items and make it immediately loggable.
4. Add independent Copy flows for foods and saved Meals, a Mine/Yours filter, and
   add-component controls for one-off Meal edits. New identities and deep snapshots are
   mandatory; copied managed photos must be omitted rather than shared.
5. Extend regression coverage for conversions, duplicate identity/snapshots, uploaded-photo
   ownership and cancellation, then run `npm test`, `npm run lint`, and a disposable
   insecure-Tailscale browser walk. Do not touch the live service or diary.
6. Update this `SPEC.md` again as the final file action only after that work is complete.

### §6.1 Current session state — 2026-09-03 (READ THIS FIRST if you are picking up)

**Full Control UX/data-safety and mobile quality passes are complete on `main` and released on the Mac Mini.**

The pass covers the lifecycle of personal foods, reusable Meals, Plan entries and food
photos: create from a purchase, edit, copy, delete, Undo, sync and capacity limits. Browser
acceptance work used disposable data; the final production walkthrough was read-only and did
not alter the household diary.

1. **Delete and Undo preserve intent and context.** Each delete or restore has an ordered
   `{ removed, at }` decision, so a newer Undo survives an older delete arriving from another
   device. Older saved deletion arrays still migrate safely. Removing a personal food records
   all affected Plan entries; Undo returns them to their original positions. If a food or
   Meal list is full, Undo remains available but restores nothing until space is made—no
   unrelated record is evicted.
2. **Purchase rows now give a safe next step.** A “Needs label” purchase has **Add details**,
   opening a personal Single Item prefilled with the exact purchased name and zero nutrition.
   The person supplies the pack facts; Nourish never invents plausible macros.
3. **Creation and copying retain control.** Alternate logging-unit conversions survive Plan
   creation. Personal foods and reusable Meals have independent Copy flows, personal items
   are filterable, and copied managed food photos are omitted rather than shared. A one-off
   Meal can search saved items and add components without changing its reusable template.
4. **Food-photo lifecycle is safer.** Closing a dialog while a new upload is in flight cleans
   up the finished temporary photo. Replace and Remove are disabled while the photo is saving,
   preventing conflicting operations.

**Final evidence**

- `npm test` completed with **214 passing checks** (54 JS/render/service and 160 TypeScript);
  `npm run lint` and `git diff --check` also completed cleanly.
- Tests include failure injection for missing assets, partial assets, silent stale database
  writes, delete/Undo resurrection, insecure-context APIs, late CSS cascade overrides and
  375/414 px media-query boundaries.
- Disposable insecure-HTTP browser passes covered purchase-to-item creation, independent Copy,
  one-off Meal component editing, repeated logging ids, photo upload/persistence, delete/Undo
  hit-testing and a 120-character unbroken food name. The hostile name originally expanded the
  page to about 1,470 px; it now wraps inside a 414 px screen.
- A read-only production browser pass covered Today, History, Trends, Purchases, Plan Items,
  Plan Meals, Settings and Log Food at 375 px and 414 px. Every visible user-facing control met
  the 44 px mobile target, no page overflowed horizontally, and the console stayed clear. The
  hidden 1×1 file input is activated by a measured 259×44 px photo label.
- The Mac Mini release is commit `ec4d3ed`, snapshot
  `releases/2026-09-03T04-35-13-901Z`, served by `com.kanwar.nourish` on `*:3902`.
  The external health command loaded the page and all six code assets at
  `http://100.81.29.11:3902`; retired port 4317 had no listener.

**Remaining deliberate scope, not a functional release blocker**

- A browser cannot select a local photo or trigger destructive restore/reset controls without
  action-time approval. Server and source regressions cover photo cleanup; a future manual
  acceptance pass may exercise the physical file-picker path against a disposable database.
- Profiles separate diary data but do not lock them; anyone on the tailnet can select a
  household profile. Authentication/security is parked by KP and must not be allowed to
  rewrite or block the current functional result.
- `app/page.tsx` and `app/globals.css` are now 2,275 and 1,144 lines. Split Plan, Track,
  logger and shared-control ownership before the next broad UI feature, preserving the current
  behaviour with the full suite and narrow-browser geometry checks.

**Checkpoint A — 2026-09-02, functional audit complete; implementation next**

KP explicitly parked authentication/security work. The renewed functional audit found two
release-blocking silent failures beyond the earlier pass:

1. Individual diary entries have stable `logId` values but no delete/restore decisions.
   Sync therefore resurrects a removed entry when another device still holds it, including
   when the removed entry was the last one on that day.
2. Keeping Log Food open for a multi-item plate reuses one pending `logId` for every food
   added during that session. The next reload can repair duplicate ids, but a sync before
   then can collapse entries and every attached photo points at the same identity.

The next implementation checkpoint must add ordered log-level deletion decisions and rotate
the pending log/photo identity after each successful add. It will also complete multiple
alternate logging units, renameable one-off Meals, abandoned log-photo cleanup, and an
offline-safe thumbnail experience before end-to-end testing.

**Checkpoint B — 2026-09-02, functional implementation complete; browser validation next**

The release-blocking failures from Checkpoint A are now repaired in the working tree:

1. **Deleting a diary entry is an ordered, syncable decision.** Log ids now participate in
   the same delete/restore clock as foods, Meals, days and weights. An older device or backup
   cannot resurrect an individually removed log, including the final entry of a day; Undo is
   a newer restore decision and wins correctly.
2. **Repeat logging is independently addressable.** Every successful add rotates to a fresh
   pending log/photo id while the logger remains open. Several foods can therefore be logged
   in one pass without sync collapsing them or assigning one photo identity to every row.
3. **Photo lifecycle follows user intent.** New log photos are removed if their unfinished
   entry is abandoned, including late upload completion. Food and log save actions wait for
   an active upload; a failed photo removal leaves the photo and shows the failure. A saved
   food photo now survives editor unmount, while deleted food/log photos are removed after
   the 10-second Undo window and retained if Undo is used.
4. **Foods and one-off Meals expose their real flexibility.** A food may define up to five
   distinct alternate units with independent labels and basis amounts; invalid, duplicate or
   circular units cannot be saved. A one-off Meal can be renamed as well as resized, extended
   and reduced without changing its reusable template. Meal components are deep snapshots,
   including aliases, provenance, bases and conversions.
5. **Catalogue startup is local-first.** Cards auto-load only bundled images and photos stored
   by Nourish. Third-party retailer hotlinks no longer create dozens of render-time network
   requests; the drawn food icon is the offline-safe fallback.

Implementation evidence so far: the full `npm test` command completed with **209 passing
checks** (49 JavaScript/render/service and 160 TypeScript). Purpose-built tests were also run
against the pre-change committed code and failed exactly as required: it resurrected a
deleted log, accepted ambiguous duplicate alternate units, and shared nested Meal snapshot
data. Lint, browser walkthrough and the final cold review remain for Checkpoint C. No live
service, household diary, commit, push or deployment action has occurred.

**Checkpoint C — 2026-09-02, browser validation; a release-blocking dead control found and fixed**

Checkpoint B's claims were re-verified rather than trusted: `npm test` reproduced **209
passing checks** and `npm run lint` passed. The browser walk then ran against a disposable
SQLite database in an isolated MacBook preview process, never the live service or the
household diary. (The preview used the then-current port; Nourish moved to 3902/3903 later
that day.)

1. **Undo was completely unclickable — found and fixed here.** `.toast` is
   `pointer-events: none` so the toast never blocks the page beneath it, but that value is
   inherited, and `.toast-undo` never opted back in. Hit-testing the rendered button
   (`document.elementFromPoint` at its own centre) returned `SECTION.timeline-panel` — the
   panel *behind* the toast. Every tap fell straight through: the button was drawn,
   announced to the accessibility tree, and dead. Because one shared toast carries Undo for
   entries, foods, Meals, weigh-ins and whole days, **the entire delete/restore model built
   in Checkpoints A and B was unreachable from the UI.** Scripted `element.click()` calls
   succeeded throughout, which is exactly why source-level and DOM-level checks all passed.
   Fixed by giving `.toast-undo` `pointer-events: auto` and a real 44px target; verified by
   a genuine mouse click at the button's coordinates returning "Put back" and restoring the
   entry, at 1280px and at 375px, with no horizontal overflow. This is the same bug class as
   `fd65693` (buttons dead on tap) — see §7.
2. **Repeat logging keeps separate identities.** Two foods logged without closing the logger
   produced two distinct `logId` values, confirmed from the diary API, not just from state.
3. **Startup is genuinely local-first.** Opening the logger issued **zero third-party
   requests** — every request was same-origin. The previous behaviour was 51 hotlinks to
   `bbassets.com`. Verified from the browser's own network log.
4. **Delete and Undo behave correctly end-to-end**, including totals recalculating and the
   entry returning to its original position.

A structural guard was added rather than only a fix: `tests/rendered-html.test.mjs` now
enumerates every `pointer-events: none` rule in `app/globals.css` against a reviewed
allowlist, so introducing a new click-through overlay fails the suite until its author
decides whether anything inside it is interactive and hit-tests it. Both failure injections
pass — a new click-through rule, and removing the Undo opt-in again — so the gate detects its
own failure (TEST-12). Regression coverage was added *before* the fix and observed failing
against the unfixed stylesheet, per TEST-01. `npm test` (209 checks) and `npm run lint` are green with the fix.
No commit, push, release, deployment, live-service or household-diary action was performed
during this checkpoint.

**Still open after Checkpoint C**

- Backup restore, full reset and profile creation/switching remain manually unexercised.
- A real file chooser successfully uploaded and saved a food photo against the disposable
  MacBook database. The cancel/backdrop branch still relies on its source and server
  regressions rather than a second destructive browser exercise.

**Checkpoint D — 2026-09-02, port merge complete; release stopped at GitHub**

The current `main` branch now contains the complete Full Control pass and the independently
prepared port migration from `origin/main`: public front door **3902**, loopback vinext
**3903**. One merge conflict occurred in a Settings comment because the remote branch still
described the pre-SQLite browser-only diary; resolution kept the current shared-database
truth. Merge commit: `23cf93b`. Port/handoff corrections: `ba84471`.

After that merge, the full `npm test` command completed with **209 passing checks** and
`npm run lint` completed cleanly. The shared `claim-gate` and `sync-agents` executables could
not be opened by macOS Python (`Operation not permitted`), so the direct command evidence is
current but no claim-gate record was written. `AGENTS.md` was aligned manually with its
already-updated `.claude/CLAUDE.md` source so no future agent is sent back to 4317/4316.

`git push origin main` was attempted normally and GitHub rejected it with an **Internal
Server Error** (request `E434:11EC0A:E9859E:F64FF8:6A983417`). Per the explicit ship plan,
there was no force push and no speculative retry. The Mac Mini was not contacted and the live
service was not restarted. Local `main` is clean at `ba84471` and five commits ahead of
`origin/main` (`994bc4b`).

**Exact resume point:** confirm GitHub is accepting writes, run the ordinary
`git push origin main`, then SSH to the Mac Mini, pull `main`, run the sanctioned
`npm run release`, and run a final live health + real hit-test at
`http://100.81.29.11:3902`. Do not deploy the older remote tip and do not force-push.

**Checkpoint E — 2026-09-03, final mobile quality pass and production release complete**

The earlier health-message correction reached the Mac Mini, then the final narrow-screen
audit exposed two last rough edges: feature-level CSS rules were overriding the original
44 px mobile target rule, and very long user-authored names could force cards beyond the
viewport. A final, intentionally last mobile target contract now protects navigation,
filters, steppers, creation/editing fields, upload links, Meal controls and removal actions.
Grid/flex shrink rules and explicit wrapping contain hostile names without hiding the data.
The regression parser now understands lower and upper media-query bounds and proves that a
later rule would be caught at both 375 px and 414 px.

Stopping the disposable dev server also exposed a double-close stack trace. Store shutdown
is now idempotent and the development coordinator exits cleanly with code 130 on Ctrl-C; a
regression covers repeated cleanup and the real process was started and stopped without an
error trace.

Commit `ec4d3ed` was pushed normally, fast-forwarded on the clean Mac Mini and published only
through `npm run release`. Snapshot `releases/2026-09-03T04-35-13-901Z` is current. The full
suite passed 214/214, lint passed, the external page and all six code assets loaded from the
Tailscale address, Node listened on `*:3902`, and port 4317 remained retired. Production was
then walked read-only at 375 px and 414 px across every primary Plan/Track area, Log Food and
Settings: no horizontal overflow, undersized visible control, console warning or console
error was observed. Household data was not changed for this final inspection.

**Checkpoint F — 2026-09-03, personal targets, weight trend and persistence proof complete**

The remaining demo-target and persistence ambiguity has been removed at runtime commit
`eb98c55`:

1. **Targets belong to the selected person and are fully editable.** Today exposes both
   **Change target** and **Adjust targets** entry points. The editor names the selected
   profile and accepts calorie, protein, carbohydrate and fat values independently up to a
   defensive 50,000 limit. An unset profile still sees clearly labelled placeholder values;
   saving creates that person's real targets rather than rewriting a shared demo constant.
2. **A later target decision wins across devices.** Targets carry their own `updatedAt`
   value and sync chooses the newer edit rather than whichever browser happens to push last.
   Local edit times are monotonic even if the device clock moves backwards. Legacy saved
   targets remain readable and keep the prior local-first tie rule.
3. **Weight history is visual without hiding the source data.** The trend opens by default
   when there are at least two weigh-ins, with a scaled area/line, points, grid, date range,
   low/high labels and the exact dated values still listed below. A single weigh-in keeps the
   honest one-point empty state rather than implying a trend.
4. **Persistence is visible and retry-safe.** A status banner always states whether the
   active profile is saved on the Mini, currently saving, browser-only or needs retry. A
   failed/unconfirmed push is never marked complete, remains dirty and retries every ten
   seconds while the app is open.

The complete suite now has **217 passing checks** (55 JavaScript/render/service and 162
TypeScript), with clean lint and diff checks. New target/parser/merge/restart/UI tests fail
against the preceding implementation. A disposable database browser pass changed targets,
recorded two weigh-ins, rendered the chart, reloaded, restarted the entire service and
returned the same canonical state hash. At 390 px the audit found the fixed mobile Log Food
button covering **Save targets**; the logger action is now hidden while the target editor is
open, and the regression asserts that ownership rule.

The production release used only `npm run release`, creating frozen snapshot
`releases/2026-09-03T10-17-08-043Z`. Before and after release, KP's server document remained
at revision 38 with SHA-256
`6adfb4d2f4564f6118c5d7327b43056a03ebe642b8f2f706725cd80aeed5c1b3`: one diary day,
zero weigh-ins and no saved personal target were preserved exactly. The read-only production
browser ran at the real insecure Tailscale origin, showed the 44 px Change target control and
the “Saved on the Mac Mini for KP” status at 390 px, had no horizontal overflow and emitted
no console messages. The page and all six referenced assets returned 200; port 4317 remained
closed. No household diary value was changed during acceptance.

## §7 Known Issues and deferred scope

| Item | State | Resolution point |
|---|---|---|
| Permanent product name | **Nourish** | Canonical product and repository name used by the app, service and current instructions. |
| Undo toast button was dead on tap | **Fixed 2026-09-02** | `.toast` is `pointer-events: none` and `.toast-undo` inherited it, so every Undo in the app fell through to the panel behind. Fixed with `pointer-events: auto` and a 44px target; asserted in `tests/rendered-html.test.mjs`. Second instance of this bug class after `fd65693` — **any new control drawn inside a click-through overlay must be hit-tested, not just rendered.** |
| Restore decisions share the 1000-slot deletion budget | Open, accepted | `removalDecisions` stores `removed: false` restores alongside real tombstones under one `MAX_REMOVED_IDS` cap, so heavy delete/Undo churn evicts the oldest decisions sooner than tombstones alone would. Bounded and safe; revisit only if the cap is ever approached. |
| Delete/restore ordering trusts the wall clock | Open, accepted | `{ removed, at }` is last-writer-wins on `Date.now()`, so a device with a badly wrong clock wins permanently, and a future-dated `at` from another device is accepted on parse. Standard trade-off for this sync model; documented rather than solved. |
| Exact calorie/macro target and personal dietary constraints | **Editable and persisted per person; constraints still open** | Calorie, protein, carbohydrate and fat targets are user-controlled and sync independently. Medical/allergy constraints remain separate reviewed scope. |
| Nandini and Epigamia seed entries rely on current label mirrors | Needs exact-pack confirmation | Reconcile barcode/variant and pack photo during cardIQ import before promotion |
| 175 food purchase rows are deliberately not auto-linked | Open, enumerated | Exact Brand + Item + Variant/form + pack evidence was accepted for 18 titles. The complete unresolved list is generated in `data/UNMATCHED_CARDIQ_FOODS.md`; label photos, barcodes, or exact retailer IDs are the safe next input. |
| Food photos cover 54 of 123 foods; 69 use drawn icons | Open, deliberately | Add a photo only after exact brand/product/variant/pack or raw/cooked form is visually confirmed. Unsafe automatic retailer/free-text sourcing stays retired. |
| Browser file-picker acceptance for food-photo cancel/backdrop cleanup | Deferred safely | Uploading a local file requires action-time approval. Source and server regressions cover the cleanup; perform one manual disposable-database acceptance pass before a release that changes this area again. |
| Full Control UX/data-safety pass | **Released 2026-09-03** | Checkpoints A–F record the audit, repairs, adversarial tests and browser passes. Runtime commit `eb98c55` has 217 passing checks and is the Mac Mini release. |
| Catalogue thumbnails are fetched from `bbassets.com` while rendering | **Resolved and browser-checked 2026-09-02** | Catalogue cards auto-load only bundled or Nourish-managed photos and otherwise use the drawn icon. Opening the logger on insecure HTTP produced zero third-party image requests. |
| Any render error blanks the entire app | **Fixed 2026-08-30, unverified in browser** | `AppErrorBoundary` now catches it and offers a reload. Its absence is what turned the `randomUUID` bug into a total outage. Needs a live trigger to confirm. |
| Main UI module and stylesheet are oversized | Architectural debt, worsening | `app/page.tsx` is 2,275 lines and `app/globals.css` is 1,144. Split by Plan/Track/product-area ownership before the next broad UI feature so one change does not require editing the whole screen. |
| Legacy meal and schema compatibility paths have no deletion date | Architectural debt | Measure whether old schema-1/single-meal data still exists, document a sunset condition, then remove the compatibility branch only after a migration/backup checkpoint. |
| Local canonical database | **Done 2026-08-23** | SQLite via `node:sqlite`, per-profile documents, 50-version server-side history, optimistic concurrency. Encrypted off-machine backup and a restore drill are still outstanding. |
| ~~Nourish's release/serve path is broken by a `cloudflare:workers` import~~ | **Not a real bug — corrected 2026-08-24** | Wrongly logged 2026-08-23: assumed (from `db/index.ts` containing `import { env } from "cloudflare:workers"`, and pattern-matching Watch Book's real bug in the same starter template) that `npm run serve` would crash, without testing it, and used a `pm2 run dev` workaround. `db/index.ts` is unused starter scaffolding. The launchd release path has since run repeatedly; the current production address is `http://100.81.29.11:3902` and the historical 4317 port is retired. |
| No authentication on the diary API | **Parked by KP, 2026-09-02** | Tailnet membership remains the boundary. Do not let this expand or block the current functional-completeness pass. |
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

### Phase 0 — Product, design system, and researched seed catalogue (implemented; KP approval remains)

- Complete information architecture, visual system, responsive behaviour, researched Items/Meals, and quantity-aware logging interactions.
- Review every Plan and Track subsection with KP.
- Freeze navigation, primary workflows, terminology, and design tokens.

**Exit gate:** KP approves the end-to-end prototype and any changes are incorporated.

### Phase 1 — Local foundation (substantially complete; off-machine backup drill remains)

- Introduce the local database, migrations, audit log, and safe backups.
- Build canonical foods, servings, recipes, recipe versions, and food-log records.
- Implement exact macro/energy calculations and provenance.

**Exit gate:** logging, edits, reloads, day totals, and backup/restore agree end-to-end.

### Phase 2 — Tracking loop (implemented)

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

### Phase 6 — Always-on Mac Mini (service active; backup hardening remains)

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
   port registry in AI HQ, and the launcher page. Current port map after the 2026-09-02
   migration: Nourish 3902 (front door) → vinext 3903 internal, cardIQ 3128, Wealth 8000,
   alug 4173, Watch Book 4400 proposed.
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

Nourish's Full Control scope is released on the Mac Mini at runtime commit `eb98c55`.
The app supports Packaged Food, Open Ingredient, Ordered Food and reusable Meal creation;
multiple independent units; quantity and macro editing; one-off Meal rename/add/remove;
personal filtering and independent Copy; purchase-to-item completion without guessed macros;
food and log photos; Plan assembly; immutable diary snapshots; History corrections; weight
editing; deletion with working Undo; additive restore; and sync that carries newer delete or
restore intent. Each profile also owns editable calorie/macro targets, a weight trend and an
honest Mini/browser persistence state. Capacity limits refuse unsafe changes rather than
evicting unrelated data.

The final suite has **217 passing checks** (55 JavaScript/render/service, 162 TypeScript),
with clean lint and diff checks. Production browser geometry is clean at 375 px and 414 px
across every primary Plan/Track surface, Log Food and Settings, and the final target check at
390 px has no horizontal overflow. The Mac Mini serves frozen snapshot
`2026-09-03T10-17-08-043Z` through launchd on port 3902; the external health check loads the
page and all six referenced code assets. The final browser inspection was read-only, and the
profile state fingerprint matched exactly before and after release.

Worth doing next, in order:

1. **Resolve purchases only from exact evidence.** Work down `data/UNMATCHED_CARDIQ_FOODS.md` with physical pack photos, barcodes, or exact retailer pages. Never restore category/reference auto-matching just to shrink the queue.
2. **Split the large UI ownership boundaries.** Extract Plan, Track, logger, and their styles before another broad UI feature; preserve behaviour with the current 217-check suite and mobile geometry checks.
3. **Complete off-machine backup hardening.** SQLite persistence and 50-version local history exist; add encrypted off-machine snapshots and perform a real restore drill.
4. **Enter each person's preferred targets.** The controls and storage are ready; a profile
   remains honestly labelled Placeholder only until that person chooses their own numbers.

Authentication/security remains explicitly parked by KP. cardIQ stays connected only through
the documented narrow import contract, without payment or address data.

## §10 Deployment

Target deployment is the always-on Mac Mini, not a public cloud product. The named service is `com.kanwar.nourish`; its public front door is **3902** and vinext stays loopback-only on **3903**. The service never selects a fallback port: if 3902 is already occupied, it exits with a clear error so the conflicting application can be fixed.

- Application: `launchd` service using `ops/com.kanwar.nourish.plist`, with `RunAtLoad`, restart after failure, and a 10-second restart throttle.
- Address: `http://localhost:3902` on each Mac. The shared launcher pulls the latest public GitHub `main` checkout before opening the local app.
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

**Operational state at 2026-09-03:** runtime commit `eb98c55` is published as frozen
snapshot `releases/2026-09-03T10-17-08-043Z`. `com.kanwar.nourish` is listening on
`*:3902`; vinext remains internal on 3903, and retired port 4317 has no listener. The
MacBook-to-Mini health command loaded the page and all six referenced code assets from
`http://100.81.29.11:3902`. The complete 217-check suite and lint passed before release.
The production UI was inspected read-only in its real insecure HTTP context at 390 px:
no horizontal overflow or console output, and Change target remained a visible 44 px
control. KP's full server-state fingerprint and revision matched before and after the
release, proving the frozen app update did not rewrite or reset the household diary.

Runbook: update the clean Mac Mini checkout with `git pull --ff-only`, then run
`npm run release`. A Git push alone does not change the running snapshot. Terminal commands
`nourish` and `health` are defined in the shared iCloud aliases file; the service itself is
the checked-in `com.kanwar.nourish` LaunchAgent.
