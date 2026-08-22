import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { applyPhotoMap } from "../scripts/apply-food-photos.mjs";

const catalogue = (entries, prefix = "") => `${prefix}const nutritionSeedItems = [\n${entries}\n];\n`;

test("a missing photo is added only to its own one-line object", () => {
  const before = catalogue(`  { id: "cucumber", name: "Cucumber" },
  { id: "tomato", imageUrl: "https://images.test/tomato-old.jpg", name: "Tomato" },`);
  const result = applyPhotoMap(before, { cucumber: "https://images.test/cucumber.jpg" });

  assert.match(result.output, /id: "cucumber", imageUrl: "https:\/\/images\.test\/cucumber\.jpg", name/);
  assert.match(result.output, /id: "tomato", imageUrl: "https:\/\/images\.test\/tomato-old\.jpg", name/);
  assert.equal(result.added, 1);
  assert.equal(result.updated, 0);
});

test("existing photos are preserved by default, even around long fields and brace-like strings", () => {
  const gap = "x".repeat(500);
  const before = catalogue(`  {
    id: "target",
    note: '${gap} } { imageUrl: "not-a-field",',
    imageUrl: "https://images.test/old.jpg",
    name: "Target",
  },
  {
    id: "next",
    imageUrl: "https://images.test/next.jpg",
    name: "Next",
  },`);
  const result = applyPhotoMap(before, { target: "https://images.test/new.jpg" });

  assert.doesNotMatch(result.output, /https:\/\/images\.test\/new\.jpg/);
  assert.match(result.output, /https:\/\/images\.test\/next\.jpg/);
  assert.match(result.output, /imageUrl: "not-a-field"/);
  assert.match(result.output, /https:\/\/images\.test\/old\.jpg/);
  assert.deepEqual(result.preserved, ["target"]);
});

test("an explicit replacement stays inside the matching multiline object", () => {
  const before = catalogue(`  {
    id: "target",
    imageUrl: "https://images.test/old.jpg",
    name: "Target",
  },
  { id: "next", imageUrl: "https://images.test/next.jpg", name: "Next" },`);
  const result = applyPhotoMap(before, { target: "https://images.test/new.jpg" }, "nutrition-data.ts", { replaceExisting: true });

  assert.match(result.output, /https:\/\/images\.test\/new\.jpg/);
  assert.match(result.output, /https:\/\/images\.test\/next\.jpg/);
  assert.doesNotMatch(result.output, /https:\/\/images\.test\/old\.jpg/);
  assert.equal(result.updated, 1);
});

test("comments and strings cannot impersonate catalogue ids", () => {
  const before = catalogue('  { id: "real", name: "Real" },', '// retired id: "ghost",\nconst note = \'id: "ghost",\';\n');
  const result = applyPhotoMap(before, { ghost: "https://images.test/ghost.jpg" });
  assert.equal(result.output, before);
  assert.deepEqual(result.missing, ["ghost"]);
});

test("malformed URLs are rejected without modifying the catalogue", () => {
  const before = catalogue('  { id: "target", name: "Target" },');
  const result = applyPhotoMap(before, {
    target: "https://exa mple.test/photo.jpg",
    second: "https://",
  });
  assert.equal(result.output, before);
  assert.deepEqual(result.skipped, ["target", "second"]);
});

test("duplicate ids fail before any edit can be written", () => {
  const before = catalogue(`  { id: "duplicate", name: "First" },
  { id: "duplicate", name: "Second" },`);
  assert.throws(
    () => applyPhotoMap(before, { duplicate: "https://images.test/photo.jpg" }),
    /duplicate catalogue ids: duplicate/,
  );
});

test("map order does not change which object receives each image", () => {
  const before = catalogue(`  { id: "milk", name: "Milk" },
  { id: "milk-toned", imageUrl: "https://images.test/old.jpg", name: "Toned" },`);
  const forward = applyPhotoMap(before, {
    milk: "https://images.test/milk.jpg",
    "milk-toned": "https://images.test/toned.jpg",
  }).output;
  const reverse = applyPhotoMap(before, {
    "milk-toned": "https://images.test/toned.jpg",
    milk: "https://images.test/milk.jpg",
  }).output;
  assert.equal(forward, reverse);
});

test("unsafe free-text and retailer photo scrapers fail closed", () => {
  for (const relative of ["../scripts/source-food-photos.mjs", "../scripts/source-product-photos.mjs"]) {
    const script = fileURLToPath(new URL(relative, import.meta.url));
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    assert.equal(result.status, 1, `${relative} must not emit an auto-applicable photo map`);
    assert.match(result.stderr, /retired/i);
    assert.equal(result.stdout, "");
  }
});
