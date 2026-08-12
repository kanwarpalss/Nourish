import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function assertPrototypeShell(html) {
  assert.match(html, /<title>Nourish — Plan well\. Track gently\.<\/title>/i);
  assert.match(html, /aria-label="Main sections"/);
  assert.match(html, />PLAN</);
  assert.match(html, />TRACK</);
  assert.match(html, /Good (morning|afternoon|evening|night), KP/);
  assert.match(html, /Daily energy/);
  assert.match(html, /Today’s timeline/);
  assert.match(html, /Log food/);
  assert.match(html, /Sample target/);
  assert.doesNotMatch(html, /Masala oats \+ dahi|Rajma chawal bowl|Banana \+ whey/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /\/Users\/kanwar\/Documents\/Health/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
}

test("server-renders the Nourish design-review prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assertPrototypeShell(await response.text());
});

test("prototype test detects a missing critical product area", () => {
  const broken = '<title>Nourish — Plan well. Track gently.</title><main aria-label="Main sections">PLAN</main>';
  assert.throws(() => assertPrototypeShell(broken), /TRACK/);
});

test("keeps the prototype complete, responsive, and free of starter residue", async () => {
  const [page, css, layout, packageJson, spec, nutrition, sources] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../app/nutrition-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/NUTRITION_SOURCES.md", import.meta.url), "utf8"),
  ]);

  for (const label of ["Items", "Meals", "Today", "History", "Trends", "Purchases"]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /Commonly ordered/);
  assert.match(page, /Nutrition updates while you edit/);

  // Logging is a session: add many foods, then commit them together.
  assert.match(page, /addToTray\(items, scaled, nextUnique\(\)\)/, "adding a food must queue it in the tray");
  assert.match(page, /onCommit\(tray\.map\(\(item\) => item\.food\)\)/, "the tray must log every queued food at once");
  assert.match(page, /Add to tray/);
  assert.match(page, /Save these as a meal/);
  assert.doesNotMatch(page, /onAdd=\{addFood\}/, "the dialog must not close after a single add any more");

  // Creating a food is its own blank flow, and saving to the library is a choice.
  assert.match(page, /Create a new food/);
  assert.match(page, /createCustomFood\(\{ \.\.\.draft, imageUrl: image \}, nextUnique\(\)\)/);
  assert.match(page, /Save to My foods for next time/);
  assert.match(page, /blankFood\(search\.trim\(\)\)/, "creating must start from a blank food, never an existing one");

  // Editing a researched food forks a personal copy instead of overwriting it.
  assert.match(page, /forkFoodForEdit\(original, nextUnique\(\)\)/);
  assert.match(page, /The researched \$\{original\.name\} is untouched/);

  // Logged entries can be removed, and the removal is reversible.
  assert.match(page, /onDelete=\{deleteLoggedFood\}/);
  assert.match(page, /undoRef\.current = \{ food: removed, index \}/);
  assert.match(page, /toast-undo/);

  // Meals are the user's own groups; researched recipes stay out of logging.
  assert.match(page, /My meals/);
  assert.match(page, /const seedLogFoods = seedFoods;/, "researched recipes must not be injected into the log catalogue");
  assert.doesNotMatch(page, /category: "Meal",\n\s*availability: meal\.serving/, "the fake meal-as-food rows must be gone");

  // Photos with a drawn fallback, never a bare letter.
  assert.match(page, /<FoodThumb food=\{food\} \/>/);
  assert.doesNotMatch(page, /food\.name\.charAt\(0\)/, "letter avatars must not come back");
  assert.match(page, /scaleNutrition\(selected, quantityValid \? quantity : 0\)/);
  assert.match(page, /getShownLogFoods\(dialogCatalog, nextTab, nextSearch\)/);
  assert.match(page, /Brand and item name are required\. Variant can be blank\./);
  assert.match(page, /Edit name, serving & nutrition/);
  assert.match(page, /You are adding \$\{quantity\} \$\{selected\.unit\}/);
  assert.match(page, /Show trend chart/);
  assert.match(page, /upsertWeightEntry/);
  assert.match(page, /shouldPersistNutritionState\(storageLoaded, loadedDayRef\.current, clock\.dayKey\)/);
  assert.match(page, /30 min or less/);
  assert.doesNotMatch(page, /Number\.parseInt\(recipe\.time/);
  assert.match(page, /needs nutrition review/);
  assert.match(page, /getBangaloreClock\(new Date\(\)\)/);
  assert.match(page, /sumLoggedNutrition\(extras, \{ calories: 0, protein: 0, carbs: 0, fat: 0 \}\)/);
  assert.match(page, /Sample data · 7 days/);
  assert.match(page, /Track · History · Sample preview/);
  assert.match(page, /Track · Trends · Sample preview/);
  assert.match(page, /Sample meal idea · not logged/);
  assert.doesNotMatch(page, /Just now ·/);
  assert.doesNotMatch(page, /Meal studio|Week plan|DiscoverView|LibraryView/);
  assert.match(nutrition, /Fudgy banana protein brownies/);
  assert.match(nutrition, /Pepper chicken cauliflower rice/);
  assert.match(nutrition, /nin\.res\.in/);
  assert.match(sources, /ICMR–National Institute of Nutrition/);
  assert.match(sources, /Source hierarchy/);
  assert.match(page, /Local import needed/);
  assert.match(page, /cardiq-food-import\.json/);
  assert.match(page, /From cardIQ/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /--lime:\s*#b9ed55/);
  assert.match(css, /--orange:\s*#ff6b32/);
  assert.match(css, /\.meal-timeline\.connected::before[^}]*left:\s*8\.5px/);
  assert.match(css, /\.timeline-dot[^}]*left:\s*0/);
  assert.match(css, /\.meal-meta > \.logged-volume[^}]*color:\s*#173e2c/);
  assert.match(css, /\.quantity-control label span[^}]*color:\s*var\(--ink\)/);
  assert.match(css, /\.food-thumb\b/, "thumbnails need styling");
  assert.match(css, /\.food-thumb img[^}]*object-fit:\s*contain/, "pack shots must fit whole, not crop to white margin");
  assert.match(css, /\.log-tray\b/);
  assert.doesNotMatch(css, /\.food-initial\b/, "the letter-avatar style must be gone with the markup");
  const lineLeft = Number(css.match(/\.meal-timeline\.connected::before[^}]*left:\s*(-?\d+(?:\.\d+)?)px/)?.[1]);
  const dotLeft = Number(css.match(/\.timeline-dot[^}]*left:\s*(-?\d+(?:\.\d+)?)(?:px)?[;}]/)?.[1]);
  const dotWidth = Number(css.match(/\.timeline-dot[^}]*width:\s*(\d+(?:\.\d+)?)px/)?.[1]);
  assert.equal(lineLeft, dotLeft + dotWidth / 2, "timeline line must pass through the dot centres");
  assert.match(layout, /title:\s*"Nourish — Plan well\. Track gently\."/);
  assert.doesNotMatch(layout, /next\/font/);
  assert.doesNotMatch(page + css + layout + packageJson, /codex-preview|_sites-preview|react-loading-skeleton/i);
  assert.match(spec, /Phase 0 — Product, design system, and researched seed catalogue \(current\)/);
  assert.match(spec, /cardIQ should (?:be|remain) connected only through the documented narrow import contract/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
