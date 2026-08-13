# Nourish (repo: Health) — Project Rules

> Loaded ONLY in Nourish sessions. Stacks with the global rulebook.
>
> **One file, two names.** This file lives at `AGENTS.md` in the repo root; `.claude/CLAUDE.md`
> is a symlink to it. Claude reads the symlink, Codex reads the root file, and neither can
> drift. Edit `AGENTS.md` — never replace the symlink with a copy.

## Stack

Next 16 / React 19 on Vite (`vinext`), TypeScript, Tailwind 4, Cloudflare Worker target; no live database — state persists in browser `localStorage`; runs as a launchd service on the Mac Mini at a fixed port.

## Invariants (break these → break the project)

1. **One food record.** Every product, ingredient, and meal is a single `Food` in `app/food-model.ts`, discriminated by `kind: "product" | "recipe"`. You must never reintroduce a second food type or a bridge that copies foods between Plan and Track — that is exactly the defect the 2026-08-13 unification removed.
2. **Recipe nutrition is derived, never stored as truth.** A recipe's macros must always be produced by `computeNutrition`/`resolveFood`/`resolveCatalog` from its `components`. You must not let a hand-entered or stale macro become the source of a meal's numbers; a component correction must reach every meal that uses it.
3. **One nutrition label = a product.** A `recipe` must have at least `MIN_RECIPE_COMPONENTS` (2) components. A ready-to-eat pack must stay `kind: "product"` with `preparedMeal: true` so it lists under both Items and Meals — never model it as a recipe.
4. **One editing surface.** All food creation and editing must go through `app/food-editor.tsx`. Do not add a second form that writes `Food` records.
5. **Never silently drop saved data.** `parseSavedNutritionState` must reject malformed entries individually and keep valid neighbours; a partly-valid record whose loss would change nutrition (a truncated component list) must be rejected whole, not repaired. Storage-key upgrades must read older keys before writing the new one.
6. **History is immutable.** A food log stores its own snapshot. Editing a food later must never rewrite what an older entry recorded.
7. **Every nutrition value carries provenance.** `source.label`, `source.url`, and `source.trust` must be set and visible. Illustrative data must be labelled **Sample** in the interface.
8. **Nothing personal enters Git.** cardIQ order history, addresses, payment data, and secrets must stay out of the repo. `public/cardiq-food-import.json` is git-ignored and must remain so.

## Critical files (read before modifying)

| File | Why |
|---|---|
| `app/food-model.ts` | The one food type, `UNIT_LIMITS`, validation, and the derived-nutrition rules. `UNIT_LIMITS` is the single source of serving bounds — `prototype-logic.ts` and `local-nutrition-state.ts` import it and must never redefine limits. |
| `app/local-nutrition-state.ts` | The storage contract and its parser. A careless loosening here silently corrupts or discards KP's diary; a careless tightening throws his data away on load. |
| `app/nutrition-data.ts` | The researched seed catalogue. Recipe macros are computed at module load; changing a product changes every meal that uses it. |
| `app/food-editor.tsx` | The only create/edit surface for both kinds. |
| `app/page.tsx` | Builds the single resolved catalogue and owns save/restore. The persist effect must depend only on what it saves. |
| `app/cardiq-food.ts` + `scripts/import-cardiq-food.ts` | The narrow cardIQ contract. Do not widen what it imports. |
| `scripts/require-nourish-port.mjs` | Enforces the fixed port; the service must never fall back to another one. |

## Deployment

Mac Mini launchd service `com.kanwar.nourish` on **port 4317**, private network/Tailscale only, no public ingress. See SPEC.md §10 in the repo root before changing anything here.

- The service must never select a fallback port — if 4317 is occupied it must exit with a clear error.
- `ops/com.kanwar.nourish.plist` hardcodes `/Users/kanwar/...` paths; it replicates across KP's Macs only because the username matches. Update it if that ever stops being true.
- Never kill whatever is already listening on 4317 — it is usually KP's running copy. For verification, start a throwaway instance on another port instead.

## Test commands

```bash
npm test
```

Runs the production build, then the rendered-HTML guards, then the unit suites. **All of it must be green before commit** — not just the file you touched. Also run:

```bash
npm run lint && npx tsc --noEmit
```

`db/index.ts` and `worker/index.ts` report missing Cloudflare types (`cloudflare:workers`, `Fetcher`, `D1Database`) — those errors are pre-existing and are the only ones you may ignore.

New behaviour must ship with a test that fails against the old code. Guard assertions in `tests/rendered-html.test.mjs` read source text on purpose; when a guarded behaviour legitimately changes, retarget the assertion — never delete it to get green.

## Project-specific rules

- **Reading code is not verification.** Nutrition maths and cross-tab flow must be exercised in a running app before being called done.
- **"No label found" is a search failure, not a fact.** A branded grocery almost always has a printed panel. Exhaust Open Food Facts by barcode, then brand + product, then the manufacturer's page, then a retailer mirror before falling back to a generic reference food — and mark the fallback as generic, never as the brand. See `data/NUTRITION_SOURCES.md`.
- **Open Food Facts: use `/cgi/search.pl`.** `/api/v2/search` silently ignores `search_terms` and returns the whole database; that bug made every lookup report "no candidate". Space requests ~6 s apart — a rate-limited reply is HTML, and must be surfaced as a retryable error, never as an absent label.
- **Reject impossible panels.** Macros in 100 g cannot exceed 100 g, and energy cannot exceed ~900 kcal/100 g. Such records describe a different serving size and would multiply every meal built on them.
- **Pulses, cereals, and grains are stored dry** unless the name says cooked; cooked weight roughly triples. State the basis in `packSize`.
- **Browser storage is ~5 MB and shared with the food diary.** Never store images or bulk data there. Catalogue thumbnails are committed to `public/food-images/` and referenced as `/food-images/<id>.jpg`; foods created in the browser take an image URL only.
- **Image URLs are untrusted input.** The parser must only accept `https?:` or same-origin `/food-images/` paths.
- **Dates and greetings use `Asia/Kolkata`.** A day must never roll over into the wrong diary.
