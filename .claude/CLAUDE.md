# Nourish — Project Rules

> Loaded ONLY in Nourish sessions. Stacks with global CLAUDE.md.
> SPEC.md describes; this file enforces.

## Stack

Next.js 16 + React 19 served through vinext/Vite 8, Tailwind 4, TypeScript.
Drizzle + Cloudflare Worker scaffolding present but unused. Node >= 22.13.
Local-only, single user, no cloud backend.

## Invariants (break these → break the project)

1. **Port 4317 only.** `scripts/require-nourish-port.mjs` must never gain a
   fallback port. If 4317 is occupied the app must exit with a plain-English
   error.
2. **Package-label calories are authoritative for packaged foods.** A 4/4/9
   calculation may be displayed alongside for comparison but must NEVER
   overwrite a label value.
3. **Every displayed nutrition value must carry its provenance tier**
   (Official label / Reference / Label mirror / Estimated / Personal). No unqualified
   numbers reach the screen.
4. **Never show a guessed macro as if it were known.** cardIQ may attach nutrition only
   when the full retailer title identifies the exact brand, item, variant and pack. An uncertain
   cardIQ
   match must render as "needs label" with the ＋ disabled. A wrong number is
   worse than a missing one.
5. **No cardIQ order data, address, or payment field may be committed.**
   `public/cardiq-food-import.json` stays gitignored, permanently.
6. **Exactly two top-level areas: Plan and Track.** New features go inside
   them, never as a third area.
7. **Filter badges must be derived from the numbers, not hand-typed**, and
   must state their rule (protein >= 25 g, fat <= 10 g, fibre >= 8 g).
8. **Illustrative data must be visibly labelled Sample** wherever it appears.
   Today's totals must only ever contain food KP actually logged.
9. **The diary keeps every day; only today's slice is ever rewritten.**
   `withDayLogs()` is the only sanctioned way to write a day. Never reintroduce
   a single-day store — that shape silently deleted the previous day at every
   Bangalore midnight (fixed 2026-08-10, regression-tested in
   `tests/day-history.test.ts`).
10. **A logged entry can always be renamed and macro-corrected by hand.** New logs keep an
    immutable nutrition snapshot so later catalogue edits never rewrite history. User edits
    are stored in `customFoods` with provenance tier "Personal"; the researched seed catalogue
    in `nutrition-data.ts` remains unchanged. Legacy `override` entries remain readable.
11. **Brand and item name are mandatory; variant may be blank.** Commercial products must
    never be collapsed into a generic/category match merely because they share an ingredient.

## Critical files (read before modifying)

| File | Why |
|---|---|
| `app/nutrition-data.ts` | The seed catalogue. A wrong number here silently propagates into every meal total and log entry. |
| `app/cardiq-food.ts` | Purchase classification and matching. A loose match assigns real macros to the wrong product. |
| `app/prototype-logic.ts` | Scaling, quantity guards, Bangalore clock, satiety estimate. All nutrition arithmetic funnels through here. |
| `app/composite-foods.ts` | Everyday dishes (chapati, sabzi) built from editable component weights. |
| `app/local-nutrition-state.ts` | The diary schema (schemaVersion 2, multi-day), custom foods, immutable log snapshots, and weight history. Getting this wrong is how the diary got silently deleted every midnight before 2026-08-10. |
| `app/day-history.ts` | Turns stored days into History/Trends totals. Overrides, composites and plain foods all resolve through `resolveLoggedFood()` here. |
| `data/NUTRITION_SOURCES.md` | Evidence register. Every macro must trace back to an entry here, including why a value was rejected. |
| `scripts/require-nourish-port.mjs` | The 4317 guard. Do not soften. |
| `ops/com.kanwar.nourish.plist` | launchd service definition for the Mac Mini. |

## Deployment

Mac Mini via **launchd** (`com.kanwar.nourish`), **not pm2** — global rule §12
assumes pm2; this project is the exception. Private network only, no public
ingress. See SPEC §10.

```bash
npm run build && npm run start   # port 4317
npm run health                   # plain-English status
```

## Test commands

```bash
npm test    # build + rendered-html + prototype-logic + cardiq-food + composites + history/state
npm run lint
```

Full suite must be green before any commit. Note `npm test` chains with `&&`,
so a failure in the first file aborts the rest — always read the final
pass/fail counts, never assume silence means green.

Any change to matching, classification, or macro data **must** ship with a
test that fails against the previous behaviour (TEST-01).

## Project-specific rules

- Browser localStorage is the ONLY persistence today. Never describe a log as
  "saved" without saying "saved in this browser".
- Logs are day-scoped via `getBangaloreClock()`. Anything date-related must use
  `Asia/Kolkata`, never the host timezone.
- No network at render time — `next/font` and other remote fetches are banned;
  a local-first app must render offline.
- Nutrition output is informational only. Never diagnose, never claim causation.
- The importer must warn loudly rather than silently truncate (it currently
  caps at `Range: 0-999` orders).
