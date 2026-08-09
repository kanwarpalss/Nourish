# Nourish

Nourish is KP’s private, local-first nutrition planning and tracking app.

The prototype has two top-level areas:

- **Plan** — search researched products/raw ingredients or choose ingredient-calculated meals.
- **Track** — log food with editable quantities and review daily, historical, trend, and real local cardIQ purchase imports.

## Current scope

- 38 researched products and ingredients with serving bases and evidence links.
- 10 original, weighed-ingredient meals with high-protein, low-fat, high-fibre, dietary, and time filters.
- Quantity-aware logging and post-log editing for grams, millilitres, scoops, packs, and servings.
- One shared Plan draft accepting either individual items or complete meals.
- Responsive desktop/mobile interface.
- Session-only state; reloads reset logs and plan selections.
- A read-only local cardIQ food snapshot: actual purchases appear in Purchases, while only matched foods become one-tap shortcuts.
- No Nourish database or Mac Mini service yet; logs remain session-only.

See [SPEC.md](./SPEC.md) for the complete roadmap and [data/NUTRITION_SOURCES.md](./data/NUTRITION_SOURCES.md) for the nutrition evidence hierarchy.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run import:cardiq
```

The preview is normally available at `http://localhost:3000`.

## Quality checks

```bash
npm test
npm run lint
```

`npm test` builds the app, checks the rendered product shell, exercises quantity scaling and boundary cases, and audits the seed catalogue’s filter rules and evidence fields.
