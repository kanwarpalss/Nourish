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
  // Today must open at zero with an empty diary and say so, and must never present a
  // placeholder target as though it were KP's own.
  assert.match(html, /0<\/strong><span>kcal eaten/);
  assert.match(html, /No food logged yet/);
  assert.match(html, /Placeholder target/);
  assert.match(html, /Set your targets/);
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
  assert.match(page, /Single Items/);
  assert.match(page, /Packaged Food/);
  assert.match(page, /Open Ingredient/);
  assert.match(page, /Ordered Food/);
  assert.match(page, /Nutrition stays on the same evidence-backed basis/);
  assert.match(page, /scaleNutritionForUnit\(selected, quantityValid \? quantity : 0, loggingUnit\)/);
  assert.match(page, /getShownSingleItems\(dialogCatalog, itemKind, search\)/);
  assert.match(page, /No brand is needed/);
  assert.match(page, /specific Subway sandwich/);
  assert.match(page, /Edit name, serving & nutrition/);

  // Creating a food must start blank and mint a fresh id. Reusing the selected
  // food's id silently replaced a researched entry with a different food.
  assert.match(page, /Add a new Single Item/);
  assert.match(page, /blankFood\(search\.trim\(\)\)/);
  assert.match(page, /createCustomFood\(\{ \.\.\.draft, imageUrl: image \}, nextUnique\(\)\)/);
  assert.match(page, /Save to Single Items for next time/);
  assert.match(page, /forkFoodForEdit\(original, nextUnique\(\)\)/);
  // The create editor must render from detailsOpen itself. Requiring an existing selected
  // result here is the exact bug that made "add Subway" do nothing after a zero-result search.
  assert.match(page, /detailsOpen \? <FoodDetailsEditor/);

  // A logged entry can be removed, reversibly, and against the stored entry
  // rather than the display row.
  assert.match(page, /onDelete=\{deleteLoggedFood\}/);
  assert.match(page, /const logIndex = removed\.logIndex/);
  assert.match(page, /index === editLogIndex/, "editing must address the stored entry too");
  assert.match(page, /toast-undo/);

  // Photos with a drawn fallback, never a bare letter.
  assert.match(page, /<FoodThumb food=\{food\} \/>/);
  assert.doesNotMatch(page, /food\.name\.charAt\(0\)/, "letter avatars must not come back");
  assert.match(page, /You are adding \$\{quantity\} \$\{loggingUnit\}/);
  assert.match(page, /Save & log Meal/);
  assert.match(page, /mealSnapshot/);
  assert.match(page, /Adjustments here apply only to today’s diary entry/);
  assert.match(page, /Show \$\{meal\.components\.length\} item/);
  assert.doesNotMatch(page, />Combination</, "the rejected Combination label must not return");
  // Modal scroll belongs to the logger and the body is explicitly frozen while it is open.
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(css, /\.food-dialog \{ overflow-y: auto; overscroll-behavior: contain;/);
  assert.match(page, /Show trend chart/);
  assert.match(page, /upsertWeightEntry/);
  assert.match(page, /if \(!storageLoaded\) return/);
  assert.match(page, /LEGACY_NUTRITION_STORAGE_KEYS/);
  assert.match(page, /30 min or less/);
  assert.doesNotMatch(page, /Number\.parseInt\(recipe\.time/);
  assert.match(page, /needs nutrition review/);
  assert.match(page, /getBangaloreClock\(new Date\(\)\)/);
  assert.match(page, /sumLoggedNutrition\(extras, \{ calories: 0, protein: 0, carbs: 0, fat: 0 \}\)/);
  // The dashboard reads from the stored diary. No fabricated history may remain anywhere.
  assert.doesNotMatch(page, /sampleWeekCalories|sampleMonthDays|sampleMeals/);
  assert.doesNotMatch(page, /Masala oats \+ dahi|Rajma chawal bowl|Banana \+ whey/);
  assert.match(page, /Last 7 days · your diary/);
  assert.match(page, /summariseHistory|summariseTrend/);
  // A day with no diary must be shown as a gap, never as a zero-calorie day.
  assert.match(page, /shown as gaps, not as zero/);
  assert.match(page, /Averages count only the days you actually logged/);
  // The one remaining example on Today stays explicitly labelled.
  assert.match(page, /Sample meal idea · not logged/);
  // A failed save must be surfaced, never swallowed.
  assert.match(page, /Nourish cannot save to this browser/);
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

  // Plan reads the live catalogue and can create/correct foods itself. Both
  // areas write to the same customFoods list, so neither can drift from the
  // other, and there is exactly one food form rather than two rule sets.
  assert.match(page, /<ItemsView planned=\{planned\} catalog=\{foodCatalog\}/, "Plan · Items must read the live catalogue, not the frozen researched list");
  assert.doesNotMatch(page, /const matched = foods\.filter/, "Plan · Items must not filter the module-level researched array");
  assert.match(page, /＋ New item/, "Plan · Items must be able to add a food");
  assert.match(page, /onEdit=\{\(food\) => setPlanFoodEditor/, "Plan · Items cards must open the editor");
  assert.match(page, /function PlanFoodEditor/);
  assert.match(page, /<FoodDetailsEditor/, "Plan must reuse the logger's editor rather than defining a second form");
  assert.equal(page.match(/function FoodDetailsEditor/g)?.length, 1, "there must be exactly one food-details form");
  assert.match(page, /forkFoodForEdit\(initial, /, "editing a researched food must fork a personal copy");
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /--lime:\s*#b9ed55/);
  assert.match(css, /--orange:\s*#ff6b32/);
  assert.match(css, /\.meal-timeline\.connected::before[^}]*left:\s*8\.5px/);
  assert.match(css, /\.timeline-dot[^}]*left:\s*0/);
  assert.match(css, /\.meal-meta > \.logged-volume[^}]*color:\s*#173e2c/);
  assert.match(css, /\.quantity-control label span[^}]*color:\s*var\(--ink\)/);
  assert.match(css, /\.quantity-control input[^}]*color:\s*var\(--ink\)/, "quantity values must remain readable on their white field");
  assert.match(css, /\.meal-component-row input[^}]*color:\s*var\(--ink\)/, "Meal amounts must remain readable on their white field");
  assert.match(css, /\.food-thumb\b/, "thumbnails need styling");
  assert.match(css, /\.food-thumb img[^}]*object-fit:\s*contain/, "pack shots must fit whole, not crop to white margin");
  assert.doesNotMatch(css, /\.food-initial\b/, "the letter-avatar style must go with the markup");
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
