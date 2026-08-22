# Nourish

Nourish is KP’s private, local-first nutrition planning and tracking app.

The prototype has two top-level areas:

- **Plan** — search researched products/raw ingredients or choose ingredient-calculated meals.
- **Track** — log food with editable quantities and review daily, historical, trend, and real local cardIQ purchase imports.

## Current scope

- 123 researched products and ingredients with serving bases, exact variants where known, and evidence links.
- 10 original, weighed-ingredient meals with high-protein, low-fat, high-fibre, dietary, and time filters.
- Quantity-aware logging and post-log editing for grams, millilitres, scoops, packs, and servings.
- One shared Plan draft accepting either individual items or complete meals.
- Responsive desktop/mobile interface.
- Food logs and Plan selections survive refresh in this browser. A mirrored browser backup plus manual JSON export/import protect against one corrupt storage key, but a different browser, Mac, or port is still a separate diary.
- A read-only local cardIQ food snapshot: 18 exact complete retailer titles become one-tap shortcuts; 175 unresolved rows stay visible and disabled rather than borrowing similar nutrition.
- A supervised Mac Mini service and release-snapshot/health workflow exist. A shared local database and automated off-browser backup remain the next durability phase.

See [SPEC.md](./SPEC.md) for the complete roadmap and [data/NUTRITION_SOURCES.md](./data/NUTRITION_SOURCES.md) for the nutrition evidence hierarchy.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run build
npm run start
npm run import:cardiq
```

Nourish always uses port **4317**. It will stop with a plain-English error if another app owns that port; it will never silently choose a different one. Open it at `http://localhost:4317` on its host Mac.

## Launch from any Mac

The iCloud-synced `nourish` and `health` terminal commands clone or fast-forward the local checkout from GitHub `main`, refresh dependencies only when the release changed, start Nourish on port 4317, and open it. This works on the Mac Mini and any other Mac that signs into KP’s iCloud aliases and has Git plus Node 22.13 or newer. Each Mac keeps its browser-local food diary separately until the shared local-database phase is built.

## Always-on Mac Mini

The checked-in macOS service definition is [ops/com.kanwar.nourish.plist](./ops/com.kanwar.nourish.plist). On the Mac Mini, after pulling the current `main` branch and running `npm ci && npm run build`, install it once:

```bash
cp ~/Code/Nourish/ops/com.kanwar.nourish.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kanwar.nourish.plist
launchctl kickstart -k gui/$(id -u)/com.kanwar.nourish
```

`launchd` restarts Nourish after a restart or crash. Check it with `npm run health` or `launchctl print gui/$(id -u)/com.kanwar.nourish`. The shared `nourish` command keeps the Mini’s checkout current whenever it is run.

## Quality checks

```bash
npm test
npm run lint
```

`npm test` builds the app and runs 115 checks covering the rendered product shell, honest health checks, quantity scaling, catalogue identity/evidence, exact purchase matching, image corruption boundaries, multi-day durability, backup restore limits, and failure injection.
