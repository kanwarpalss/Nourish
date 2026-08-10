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
  assert.match(page, /Commonly ordered/);
  assert.match(page, /Nutrition updates while you edit/);
  assert.match(page, /scaleNutrition\(selected, quantityValid \? quantity : 0\)/);
  assert.match(page, /getShownLogFoods\(nextTab, nextSearch\)/);
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
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /--lime:\s*#b9ed55/);
  assert.match(css, /--orange:\s*#ff6b32/);
  assert.match(css, /\.meal-timeline\.connected::before[^}]*left:\s*8\.5px/);
  assert.match(css, /\.timeline-dot[^}]*left:\s*0/);
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
