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
  const [page, css, layout, packageJson, spec, nutrition, sources, state, sync] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../SPEC.md", import.meta.url), "utf8"),
    readFile(new URL("../app/nutrition-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/NUTRITION_SOURCES.md", import.meta.url), "utf8"),
    readFile(new URL("../app/local-nutrition-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/diary-sync.ts", import.meta.url), "utf8"),
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
  assert.match(page, /deleteLoggedEntry\(clock\.dayKey, removed\.logIndex/, "removing must address the stored entry, not the display row");
  assert.match(page, /index === editLogIndex/, "editing must address the stored entry too");
  assert.match(page, /toast-undo/);

  // Anything KP creates, he can delete. Undo is the safety net rather than a
  // confirmation modal on every tap — a modal per delete makes tidying up a chore.
  assert.match(page, /deleteRecord\("customFood", food\.id/, "a food you created must be deletable");
  assert.match(page, /deleteRecord\("userMeal", meal\.id/, "a saved meal must be deletable");
  assert.match(page, /deleteRecord\("weight", date/, "a weigh-in must be deletable");
  assert.match(page, /deleteRecord\("day", dayKey/, "a whole past day must be deletable");
  assert.match(page, /onDeleteEntry=\{deleteLoggedEntry\}/, "past days must be correctable entry by entry, not only wholesale");
  assert.match(page, /restoreRecord\(current, pending\.record\)/, "every small delete must be undoable");
  // A deletion has to be remembered, or restoring any older backup silently undoes it.
  assert.match(state, /skippedAsDeleted/, "restore must report what it held back as deleted");
  assert.match(state, /isRemoved\(current\.removed, "userMeal", id\)/, "restore must consult the deletion record");
  assert.match(page, /stays deleted rather than reappearing/, "settings must say that deletions survive a restore");
  // The one genuinely destructive control asks KP to type, rather than relying on
  // an Undo toast he may not reach in time.
  assert.match(page, /Type <b>DELETE<\/b> to confirm/);
  assert.match(page, /confirmText\.trim\(\) !== "DELETE"/);
  assert.match(page, /clearAllUserData\(current\)/);
  // Deleting happens on the phone as much as the desktop, so every new control needs a tap target.
  assert.match(css, /\.weight-entry-list button,\s*\.history-entry-list button,\s*\.history-delete-confirm button,\s*\.danger-confirm button \{\s*min-height: 44px;\s*min-width: 44px;/, "the new delete controls need 44px tap targets on a phone");

  /**
   * The toast floats over the page and must not block what is underneath it, so
   * `.toast` is `pointer-events: none`. That is inherited, which silently made
   * the Undo button inside it unclickable: the tap fell straight through to the
   * panel behind. Undo is the only way back from a deletion, so the button has
   * to opt back in — and be a real 44px target, because deletions happen on the
   * phone. Found 2026-09-02 by hit-testing the rendered button.
   */
  assert.match(css, /\.toast \{[^}]*pointer-events: none;/, "the toast itself must stay click-through");

  /**
   * The guard against a second dead control rather than a second fix.
   *
   * `pointer-events: none` is the mechanism that made Undo unclickable, and it is
   * invisible to markup checks, accessibility snapshots and scripted clicks alike.
   * So every click-through rule in the stylesheet has to be declared here on
   * purpose. Adding a new one fails this test until its author decides whether
   * anything inside it is interactive — and if so, hit-tests it in a browser
   * (`document.elementFromPoint(centre) === theControl`) rather than trusting that
   * it rendered. Decorative pseudo-elements are listed because they hold nothing
   * clickable; a real element listed here must name the control that opts back in.
   */
  const clickThrough = [...css.matchAll(/([^{}]+)\{[^}]*pointer-events:\s*none/g)].map(([, selector]) => selector.trim().split(/\s*\n\s*/).pop());
  assert.deepEqual(
    clickThrough.sort(),
    [".energy-card::after", ".toast"],
    "a new click-through rule appeared: decide whether anything inside it is interactive, hit-test it in a browser, then add it here",
  );
  // `.toast` is the one that holds a control, so that control must opt back in.
  assert.match(css, /\.toast-undo \{[^}]*pointer-events: auto;/, "the Undo button must opt back into clicks or it is dead on tap");
  assert.match(css, /\.toast-undo \{[^}]*min-height: 44px;/, "Undo needs a 44px tap target on a phone");

  // Photos with a drawn fallback, never a bare letter.
  assert.match(page, /<FoodThumb food=\{food\} \/>/);
  assert.doesNotMatch(page, /food\.name\.charAt\(0\)/, "letter avatars must not come back");
  assert.match(page, /You are adding \$\{quantity\} \$\{loggingUnit\}/);
  assert.match(page, /Save & log Meal/);
  assert.match(page, /mealSnapshot/);
  assert.match(page, /Rename, resize, add, or remove anything here/);
  assert.match(page, /Meal name for today/);
  assert.match(page, /setPendingLogId\(freshUnique\(\)\)/, "each repeated add must rotate to a fresh diary and photo identity");
  assert.match(page, /disabled=\{photoBusy \|\| !isFoodDetailsValid\(draft\)\}/, "food saving must wait for its photo upload result");
  assert.match(page, /shouldKeep=\{\(\) => savedPhotoEditRef\.current\}/, "a food photo must survive the editor closing after a real save");
  assert.match(page, /discardIfUncommitted=\{!editing\}/, "an abandoned new log photo must be removed rather than stranded");
  assert.match(page, /scheduleLogPhotoCleanup\(entry\.logId\)/, "deleted diary photos must follow their diary entries after the Undo window");
  assert.match(page, /deleteFoodPhoto\(profileId, photoKey\)/, "deleted custom foods must not leave permanent photo files behind");
  assert.match(page, /Add another unit/);
  assert.match(page, /isAutoLoadedFoodImage\(food\.imageUrl\)/, "catalogue thumbnails must stay offline-safe");
  assert.match(page, /Show \$\{meal\.components\.length\} item/);
  assert.doesNotMatch(page, />Combination</, "the rejected Combination label must not return");
  // Modal scroll belongs to the logger and the body is explicitly frozen while it is open.
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(css, /\.food-dialog \{ overflow-y: auto; overscroll-behavior: contain;/);
  assert.match(page, /Show trend chart/);
  assert.match(page, /upsertWeightEntry/);
  assert.match(page, /if \(!storageLoaded \|\| loadedProfile !== profileId\) return/, "nothing may be written back before that profile's diary has finished loading");
  // Reading older storage keys still has to happen on load; it moved out of the
  // component into readStoredNutritionRaw, which also falls back to the backup.
  assert.match(page, /readStoredNutritionRaw\(window\.localStorage, storageKeys\)/, "load must go through the backup-aware reader, for the profile in view");
  assert.match(page, /writeStoredNutritionState\(window\.localStorage, saved, storageKeys\)/, "saves must snapshot a backup first, into that profile's own keys");

  // The diary now also lives in SQLite on the Mac Mini, with the browser copy as
  // the working copy. Nothing here may claim a server copy exists unless one does.
  assert.match(page, /describeSyncStatus\(syncStatus, activeProfile\?\.name\)/, "the screen must state where the diary actually is");
  assert.match(sync, /Saved in this browser only — the Mac Mini is not reachable/, "an unreachable server must be said plainly, not hidden");
  assert.match(sync, /if \(response\.status === 409\)/, "a save that lost a race must merge and retry, never overwrite");
  assert.match(sync, /mergeSyncedStates\(state, parseSavedNutritionState/, "the server's copy is parsed like any other stored bytes before being trusted");
  assert.match(page, /lastPushedRef\.current === saved/, "an unchanged diary must not be re-sent forever");
  assert.match(state, /export function mergeSyncedStates/);
  assert.match(state, /export function withLogIds/, "entries need stable ids or a two-device merge drops one");
  // Two people, two diaries. A shared total would be worse than no sync at all.
  assert.match(page, /nutritionStorageKeys\(profileId\)/);
  assert.match(state, /profileId === FIRST_PROFILE_ID/, "the first profile must keep the original keys so the existing diary carries over untouched");
  // Switching person changes the storage keys and the sync target immediately, but
  // `saved` still holds the previous diary until its own load finishes. Every read,
  // write and sync must therefore wait for the load of THAT profile. Without this
  // guard, switching to a second person wrote the first person's whole diary into
  // the second person's row, on the device and on the Mac Mini — observed, not theorised.
  assert.equal((page.match(/loadedProfile !== profileId/g) ?? []).length, 3,
    "the localStorage write, the pull and the push must each refuse to run mid-switch");
  assert.match(page, /setLoadedProfile\(profileId\)/, "and the guard must be released only once that profile's diary is actually loaded");
  assert.match(state, /LEGACY_NUTRITION_STORAGE_KEYS/, "older keys must still be read somewhere");
  assert.match(state, /NUTRITION_BACKUP_STORAGE_KEY/);
  // Forward compatibility: an older build must not delete fields a newer one wrote.
  assert.match(state, /carried/, "unknown stored fields must be carried through");
  assert.doesNotMatch(page, /localStorage\.setItem\(LOCAL_NUTRITION_STORAGE_KEY/, "no direct write may bypass the backup");
  // The dead settings control is now a real panel, and it tells the truth about scope.
  assert.match(page, /function SettingsPanel/);
  assert.match(page, /onClick=\{\(\) => setSettingsOpen\(true\)\}/, "the settings button must actually open something");
  assert.match(page, /Download backup/);
  assert.match(page, /also stored there and shared between\s+connected devices/, "settings must explain that a confirmed Mac Mini copy is shared, not browser-only");
  assert.doesNotMatch(page, /different diary — they do not sync/, "settings must not contradict the live sync status");
  // The sidebar is hidden on mobile, so settings needs its own header entry or
  // backup and restore are unreachable on a phone.
  assert.match(page, /mobile-settings/, "settings must be reachable without the desktop sidebar");
  assert.match(css, /\.mobile-topbar > \.mobile-settings \{[^}]*44px/, "the mobile settings control needs a 44px tap target");
  assert.match(page, /30 min or less/);
  assert.doesNotMatch(page, /Number\.parseInt\(recipe\.time/);
  // An unresolved purchase still cannot quick-log guessed macros, but it must
  // offer the safe escape hatch into a blank, pre-filled label-details editor.
  assert.match(page, /Exact pack label needed/);
  assert.match(page, /Add exact label details for/);
  assert.match(page, /onCreateFromPurchase/);
  assert.match(page, /initialName: name/);
  assert.match(page, /Copy Single Item/);
  assert.match(page, /Copy meal/);
  assert.match(page, /Search items to add to this one-off meal/);
  assert.match(page, /disposedRef\.current = true/, "a close during an upload must clean a late successful temporary food photo");
  assert.match(page, /if \(disposedRef\.current\)/, "the upload completion must not update an unmounted editor");
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
  // Quick-add can legitimately include several variants with the same visible
  // name (for example, Coca-Cola Original and Zero). React keys must use the
  // stable food id, or one button can be duplicated or lost during an update.
  assert.match(page, /quickFoods\.slice\(0, 4\)\.map\(\(food\) => \(\s*<button key=\{food\.id\}/, "Quick add must key foods by their stable id, not their display name");
  assert.doesNotMatch(page, /quickFoods\.slice\(0, 4\)\.map\(\(food\) => \(\s*<button key=\{food\.name\}/, "Quick add display names are not unique");

  // Plan reads the live catalogue and can create/correct foods itself. Both
  // areas write to the same customFoods list, so neither can drift from the
  // other, and there is exactly one food form rather than two rule sets.
  assert.match(page, /<ItemsView planned=\{planned\} catalog=\{foodCatalog\}/, "Plan · Items must read the live catalogue, not the frozen researched list");
  assert.doesNotMatch(page, /const matched = foods\.filter/, "Plan · Items must not filter the module-level researched array");
  assert.match(page, /＋ New item/, "Plan · Items must be able to add a food");
  assert.match(page, /onEdit=\{\(food\) => setPlanFoodEditor/, "Plan · Items cards must open the editor");
  assert.match(page, /function PlanFoodEditor/);
  assert.match(page, /<FoodDetailsEditor/, "Plan must reuse the logger's editor rather than defining a second form");
  // A photo picker must not make Cancel lie. A replacement is staged under a
  // temporary key, abandoned uploads are discarded, and the old picture is
  // removed only after the food itself has been saved.
  assert.match(page, /const \[initialFoodPhotoKey\] = useState\(\(\) => foodPhotoKeyFromUrl\(draft\.imageUrl\)\)/);
  assert.match(page, /if \(pendingPhotoKeyRef\.current\) void deleteFoodPhoto\(profileId, pendingPhotoKeyRef\.current\)/, "Cancel must clean a temporary food photo");
  assert.match(page, /if \(initialFoodPhotoKey && initialFoodPhotoKey !== finalPhotoKey\) void deleteFoodPhoto\(profileId, initialFoodPhotoKey\)/, "Save must retire the replaced photo only after the food points elsewhere");
  assert.equal(page.match(/function FoodDetailsEditor/g)?.length, 1, "there must be exactly one food-details form");
  assert.match(page, /forkFoodForEdit\(initial, /, "editing a researched food must fork a personal copy");

  // Plan · Meals shows KP's own saved meals and ready-to-eat products beside the
  // researched recipes, and can build a meal without going through the logger.
  assert.match(page, /＋ New meal/);
  assert.match(page, /function PlanMealBuilder/);
  assert.match(page, /userMeals=\{saved\.userMeals\}/, "Plan · Meals must read the saved meals Track writes");
  assert.match(page, /food\.category === "OrderedFood"/, "a ready-to-eat product must list under Meals as well as Items");
  // One meal-building component, two callers. A second copy is how the two
  // drift apart, so the count is asserted rather than left to discipline.
  assert.equal(page.match(/function MealComposer/g)?.length, 1, "there must be exactly one meal composer");
  assert.equal(page.match(/<MealComposer/g)?.length, 2, "both the logger and Plan must render the shared composer");
  assert.doesNotMatch(page, /className="meal-builder"/, "the logger's hand-rolled meal markup must stay deleted");
  assert.match(page, /createUserMeal\(name, items, /, "Plan must reuse the tray's meal validation, not re-implement it");
  assert.match(page, /createUserMeal\(mealName, mealLines, /, "and the logger keeps constructing through the same helper");
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
