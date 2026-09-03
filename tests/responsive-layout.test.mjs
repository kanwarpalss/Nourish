import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Does a page layout actually fit the window it is shown in?
 *
 * The bug this exists to catch: Today kept its three-column arrangement down to
 * 1261px, but three columns need 1034px and a 1280px window only offers about
 * 911px once the 252px sidebar and 4vw of padding are taken out. The page was
 * 117px too wide and scrolled sideways, cutting off the weight card and Quick
 * add. History had the same fault over a wider range.
 *
 * A browser would measure this directly, but adding a headless browser to a
 * local-first app is a big dependency for one check. The geometry is all in the
 * stylesheet, so the arithmetic is done here instead — which also means the test
 * fires if someone widens the sidebar or the padding, not just the grid.
 */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Flattens the stylesheet to { selector, minWidth, maxWidth, decls }, keeping source order. */
function parseCss(css) {
  const rules = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) break;
    const prelude = css.slice(index, open).trim();
    if (prelude.startsWith("@")) {
      let depth = 1;
      let cursor = open + 1;
      while (cursor < css.length && depth > 0) {
        if (css[cursor] === "{") depth += 1;
        else if (css[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      const maximum = prelude.match(/max-width:\s*(\d+)px/);
      const minimum = prelude.match(/min-width:\s*(\d+)px/);
      const maxWidth = maximum ? Number(maximum[1]) : Infinity;
      const minWidth = minimum ? Number(minimum[1]) : 0;
      for (const rule of parseCss(css.slice(open + 1, cursor - 1))) {
        rules.push({
          ...rule,
          minWidth: Math.max(minWidth, rule.minWidth),
          maxWidth: Math.min(maxWidth, rule.maxWidth),
        });
      }
      index = cursor;
      continue;
    }
    const close = css.indexOf("}", open);
    const decls = {};
    for (const part of css.slice(open + 1, close).split(";")) {
      const colon = part.indexOf(":");
      if (colon > 0) decls[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
    }
    for (const selector of prelude.split(",")) {
      rules.push({ selector: selector.trim(), minWidth: 0, maxWidth: Infinity, decls });
    }
    index = close + 1;
  }
  return rules;
}

/** Last matching declaration wins — every selector here is a single class, so specificity is equal. */
function declaration(rules, selector, property, viewport) {
  let winner;
  for (const rule of rules) {
    if (rule.selector !== selector || viewport < rule.minWidth || viewport > rule.maxWidth) continue;
    if (rule.decls[property] !== undefined) winner = rule.decls[property];
  }
  return winner;
}

/** Splits a value on spaces while keeping bracketed groups such as clamp(a, b, c) whole. */
function splitTopLevel(value, separator = /\s/) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0 && separator.test(character)) {
      if (current) parts.push(current);
      current = "";
    } else current += character;
  }
  if (current) parts.push(current);
  return parts;
}

function resolveLength(token, viewport) {
  if (!token) return 0;
  const clamp = token.match(/^clamp\((.*)\)$/);
  if (clamp) {
    const [min, preferred, max] = splitTopLevel(clamp[1], /,/).map((part) => resolveLength(part.trim(), viewport));
    return Math.min(Math.max(min, preferred), max);
  }
  if (token.endsWith("vw")) return (Number.parseFloat(token) / 100) * viewport;
  if (token.endsWith("px")) return Number.parseFloat(token);
  return 0;
}

/** The narrowest this grid can be drawn: every column's minimum, plus the gaps between them. */
function minimumGridWidth(template, gap, viewport) {
  const columns = splitTopLevel(template).flatMap((token) => {
    const repeat = token.match(/^repeat\((.*)\)$/);
    if (repeat) {
      const [count, pattern] = splitTopLevel(repeat[1], /,/).map((part) => part.trim());
      // auto-fit and auto-fill add columns only when they fit, so they cannot overflow.
      if (!/^\d+$/.test(count)) return [];
      return Array.from({ length: Number(count) }, () => pattern);
    }
    return [token];
  });
  const minimums = columns.map((column) => {
    const minmax = column.match(/^minmax\((.*)\)$/);
    if (minmax) return resolveLength(splitTopLevel(minmax[1], /,/)[0].trim(), viewport);
    return resolveLength(column, viewport);
  });
  const total = minimums.reduce((sum, value) => sum + value, 0);
  return { total: total + Math.max(0, columns.length - 1) * resolveLength(gap, viewport), columns: columns.length };
}

/**
 * Usable width inside the workspace. The scrollbar is real estate the layout does
 * not get but `vw` still counts, which is exactly the margin the old numbers were
 * short by, so it is subtracted here rather than assumed away.
 */
function workspaceWidth(rules, viewport, scrollbarWidth = 15) {
  const marginLeft = resolveLength(declaration(rules, ".workspace", "margin-left", viewport), viewport);
  const padding = splitTopLevel(declaration(rules, ".workspace", "padding", viewport) ?? "0px");
  const horizontal = resolveLength(padding.length > 1 ? padding[1] : padding[0], viewport);
  return viewport - scrollbarWidth - marginLeft - horizontal * 2;
}

/** Every layout that is a direct child of the workspace and sets its own columns. */
const PAGE_LAYOUTS = [
  ".today-layout",
  ".history-layout",
  ".trends-grid",
  ".recipe-grid",
  ".item-catalogue-grid",
  ".purchase-summary",
  ".own-meal-grid",
];

/** Real window widths: iPhone, small tablet, the 1260/1440 breakpoints and either side of them. */
const VIEWPORTS = [375, 414, 768, 900, 1024, 1180, 1261, 1280, 1366, 1439, 1440, 1512, 1728, 1920];

async function loadRules() {
  return parseCss(stripComments(await readFile(new URL("../app/globals.css", import.meta.url), "utf8")));
}

test("no page layout is wider than the window it is drawn in", async () => {
  const rules = await loadRules();
  const failures = [];
  for (const viewport of VIEWPORTS) {
    const available = workspaceWidth(rules, viewport);
    for (const selector of PAGE_LAYOUTS) {
      const display = declaration(rules, selector, "display", viewport);
      if (display === "block" || display === "none") continue;
      const template = declaration(rules, selector, "grid-template-columns", viewport);
      if (!template) continue;
      const { total, columns } = minimumGridWidth(template, declaration(rules, selector, "gap", viewport) ?? "0px", viewport);
      if (total > available) {
        failures.push(`${selector} at ${viewport}px needs ${Math.round(total)}px across ${columns} columns but only has ${Math.round(available)}px`);
      }
    }
  }
  assert.deepEqual(failures, [], `these layouts overflow their window and scroll sideways:\n  ${failures.join("\n  ")}`);
});

test("failure injection: the old three-column Today is caught", async () => {
  // The exact stylesheet that shipped the bug — three columns held down to 1261px.
  const broken = parseCss(stripComments(`
    .workspace { margin-left: 252px; padding: 44px clamp(28px, 4vw, 68px) 80px; }
    .today-layout { display: grid; grid-template-columns: minmax(420px, 1.08fr) minmax(360px, 0.94fr) minmax(270px, 0.68fr); gap: 22px; }
    @media (max-width: 1260px) { .today-layout { grid-template-columns: minmax(420px, 1.1fr) minmax(340px, 0.9fr); } }
  `));
  const available = workspaceWidth(broken, 1280);
  const { total } = minimumGridWidth(declaration(broken, ".today-layout", "grid-template-columns", 1280), "22px", 1280);
  assert.ok(total > available, "a check that cannot catch the original bug is not a check");
  // And the same stylesheet must pass once the breakpoint covers the gap.
  const fixed = parseCss(stripComments(`
    .workspace { margin-left: 252px; padding: 44px clamp(28px, 4vw, 68px) 80px; }
    .today-layout { display: grid; grid-template-columns: minmax(390px, 1.08fr) minmax(345px, 0.94fr) minmax(255px, 0.68fr); gap: 22px; }
    @media (max-width: 1439px) { .today-layout { grid-template-columns: minmax(420px, 1.1fr) minmax(340px, 0.9fr); } }
  `));
  const repaired = minimumGridWidth(declaration(fixed, ".today-layout", "grid-template-columns", 1280), "22px", 1280);
  assert.ok(repaired.total <= workspaceWidth(fixed, 1280), "and the fix must actually fit");
});

test("the widest arrangement still returns on a large screen", async () => {
  const rules = await loadRules();
  // The narrow layout is a fallback, not the destination: a 1440px window must
  // still get three columns on Today and two on History.
  const today = minimumGridWidth(declaration(rules, ".today-layout", "grid-template-columns", 1440), "22px", 1440);
  const history = minimumGridWidth(declaration(rules, ".history-layout", "grid-template-columns", 1440), "22px", 1440);
  assert.equal(today.columns, 3, "Today should be three columns at 1440px");
  assert.equal(history.columns, 2, "History should be two columns at 1440px");
  assert.equal(minimumGridWidth(declaration(rules, ".today-layout", "grid-template-columns", 1280), "22px", 1280).columns, 2, "and two columns at 1280px");
});

test("mobile navigation, creation and correction controls keep 44px touch targets", async () => {
  const rules = await loadRules();
  const heightSelectors = [
    ".mobile-subnav button",
    ".close-button",
    ".logging-mode-switch button",
    ".single-item-filters button",
    ".logging-unit-field select",
    ".edit-food-button",
    ".weight-add-button",
    ".filter-row .chip",
    ".segmented button",
    ".recipe-title",
    ".item-card-actions a",
    ".research-footnote a",
    ".target-fields input",
    ".details-heading button",
    ".food-type-field select",
    ".identity-fields input",
    ".serving-fields input",
    ".serving-fields select",
    ".conversion-fields input",
    ".conversion-fields select",
    ".conversion-fields label > div",
    ".nutrition-fields label > div",
    ".nutrition-fields input",
    ".conversion-add",
    ".override-fields input",
    ".meal-name-field input",
    ".weight-form input",
    ".weight-form .button",
    ".plan-summary-items button",
    ".meal-composer-lines > div > button",
    ".meal-composer-lines label",
    ".meal-composer-lines label input",
    ".conversion-remove",
    ".meal-expand-button",
    ".weight-trend-toggle",
    ".food-photo-link",
    ".component-control > button",
    ".component-control input",
  ];
  const failures = [375, 414].flatMap((viewport) =>
    heightSelectors
      .filter((selector) => declaration(rules, selector, "min-height", viewport) !== "44px !important")
      .map((selector) => `${selector} at ${viewport}px`),
  );
  assert.deepEqual(failures, [], `these mobile controls lost their 44px tap height: ${failures.join(", ")}`);

  const squareSelectors = [
    ".text-button",
    ".close-button",
    ".single-item-filters button",
    ".filter-row .chip",
    ".table-actions .chip",
    ".details-heading button",
    ".quantity-control > button",
    ".entry-buttons button",
    ".item-card-actions a",
    ".plan-summary-items button",
    ".meal-composer-lines > div > button",
    ".conversion-remove",
    ".component-control > button",
  ];
  const narrow = [375, 414].flatMap((viewport) =>
    squareSelectors
      .filter((selector) => declaration(rules, selector, "min-width", viewport) !== "44px !important")
      .map((selector) => `${selector} at ${viewport}px`),
  );
  assert.deepEqual(narrow, [], `these compact mobile controls lost their 44px tap width: ${narrow.join(", ")}`);
  assert.equal(
    declaration(rules, ".quantity-control", "grid-template-columns", 375),
    "44px minmax(0, 1fr) 44px",
    "quantity steppers must reserve the full tap width rather than overlap the input",
  );
  assert.equal(declaration(rules, ".logged-meal-components span", "min-width", 375), "0");
  assert.equal(declaration(rules, ".logged-meal-components span", "overflow-wrap", 375), "anywhere");
  assert.equal(declaration(rules, ".meal-entry", "grid-template-columns", 375), "minmax(0, 1fr) auto");
  assert.equal(declaration(rules, ".meal-meta strong", "overflow-wrap", 375), "anywhere");
  assert.equal(declaration(rules, ".food-results", "min-width", 375), "0");
  assert.equal(declaration(rules, ".food-results > button", "grid-template-columns", 375), "auto minmax(0, 1fr) auto auto");
  assert.equal(declaration(rules, ".quantity-editor", "min-width", 375), "0");
  assert.equal(declaration(rules, ".quantity-editor h3", "overflow-wrap", 375), "anywhere");
  assert.equal(declaration(rules, ".create-food-row", "grid-template-columns", 375), "auto minmax(0, 1fr)");
});

test("failure injection: a later feature rule can shrink a reviewed touch target", () => {
  const broken = parseCss(stripComments(`
    @media (max-width: 700px) { .close-button { min-height: 44px; } }
    .close-button { min-height: 38px; }
  `));
  assert.equal(declaration(broken, ".close-button", "min-height", 375), "38px");
  assert.notEqual(declaration(broken, ".close-button", "min-height", 375), "44px");
});

test("failure injection: media-query lower bounds distinguish 375px and 414px phones", () => {
  const ranged = parseCss(stripComments(`
    @media (max-width: 700px) { .close-button { min-height: 44px; } }
    @media (min-width: 400px) and (max-width: 700px) { .close-button { min-height: 32px; } }
  `));
  assert.equal(declaration(ranged, ".close-button", "min-height", 375), "44px");
  assert.equal(declaration(ranged, ".close-button", "min-height", 414), "32px");
});
