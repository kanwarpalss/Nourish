/**
 * Applies an id -> photo URL map to the nutrition seed catalogue:
 *   node scripts/apply-food-photos.mjs photos.json
 *
 * TypeScript's parser keeps every edit inside the exact object whose `id`
 * matched. A text regex used here previously crossed object boundaries and
 * silently moved cucumber, egg, peanut-butter and other photos onto the next
 * food in the array.
 */

import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function propertyNamed(object, name) {
  return object.properties.find((property) => ts.isPropertyAssignment(property)
    && ((ts.isIdentifier(property.name) && property.name.text === name)
      || (ts.isStringLiteral(property.name) && property.name.text === name)));
}

function catalogueObjects(source, filename = "nutrition-data.ts") {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((item) => ts.isIdentifier(item.name) && item.name.text === "nutritionSeedItems");

  if (!declaration || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error("nutritionSeedItems array was not found");
  }

  const byId = new Map();
  const duplicates = new Set();
  for (const element of declaration.initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const idProperty = propertyNamed(element, "id");
    if (!idProperty || !ts.isStringLiteral(idProperty.initializer)) continue;
    const id = idProperty.initializer.text;
    if (byId.has(id)) duplicates.add(id);
    else byId.set(id, { object: element, idProperty });
  }
  if (duplicates.size) throw new Error(`duplicate catalogue ids: ${[...duplicates].join(", ")}`);
  return { byId, file };
}

function safeHttpsUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname && !/\s/.test(value) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Pure transformation used by the CLI and regression tests. */
export function applyPhotoMap(source, photos, filename = "nutrition-data.ts", { replaceExisting = false } = {}) {
  if (!photos || typeof photos !== "object" || Array.isArray(photos)) {
    throw new Error("photo map must be a JSON object");
  }

  const { byId, file } = catalogueObjects(source, filename);
  const edits = [];
  const missing = [];
  const skipped = [];
  const preserved = [];
  let added = 0;
  let updated = 0;

  for (const [id, candidate] of Object.entries(photos)) {
    const url = safeHttpsUrl(candidate);
    if (!url) {
      skipped.push(id);
      continue;
    }
    const found = byId.get(id);
    if (!found) {
      missing.push(id);
      continue;
    }

    const imageProperty = propertyNamed(found.object, "imageUrl");
    if (imageProperty) {
      if (!replaceExisting) {
        preserved.push(id);
        continue;
      }
      edits.push({
        start: imageProperty.initializer.getStart(file),
        end: imageProperty.initializer.getEnd(),
        text: JSON.stringify(url),
      });
      updated += 1;
      continue;
    }

    const propertyEnd = found.idProperty.getEnd();
    const commaOffset = source.slice(propertyEnd, found.object.getEnd()).search(/\S/);
    if (commaOffset < 0 || source[propertyEnd + commaOffset] !== ",") {
      throw new Error(`catalogue id ${id} does not end with a comma`);
    }
    const insertAt = propertyEnd + commaOffset + 1;
    const lineStart = source.lastIndexOf("\n", found.idProperty.getStart(file)) + 1;
    const indent = source.slice(lineStart, found.idProperty.getStart(file)).match(/^\s*/)?.[0] ?? "";
    const objectIsMultiline = source.slice(found.object.getStart(file), found.object.getEnd()).includes("\n");
    edits.push({
      start: insertAt,
      end: insertAt,
      text: objectIsMultiline ? `\n${indent}imageUrl: ${JSON.stringify(url)},` : ` imageUrl: ${JSON.stringify(url)},`,
    });
    added += 1;
  }

  const output = edits
    .sort((left, right) => right.start - left.start)
    .reduce((value, edit) => value.slice(0, edit.start) + edit.text + value.slice(edit.end), source);
  return { output, added, updated, missing, skipped, preserved };
}

function main() {
  const replaceExisting = process.argv.includes("--replace-existing");
  const mapPath = process.argv.slice(2).find((argument) => argument !== "--replace-existing");
  if (!mapPath) {
    console.error("usage: node scripts/apply-food-photos.mjs <photos.json> [--replace-existing]");
    process.exitCode = 1;
    return;
  }

  const photos = JSON.parse(readFileSync(mapPath, "utf8"));
  const dataPath = fileURLToPath(new URL("../app/nutrition-data.ts", import.meta.url));
  const source = readFileSync(dataPath, "utf8");
  const result = applyPhotoMap(source, photos, dataPath, { replaceExisting });
  for (const id of result.skipped) console.error(`skip ${id}: not a valid https URL`);

  if (result.output !== source) {
    const temporaryPath = `${dataPath}.photo-update-${process.pid}`;
    try {
      writeFileSync(temporaryPath, result.output);
      renameSync(temporaryPath, dataPath);
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
  }
  console.log(`added ${result.added}, updated ${result.updated}, preserved ${result.preserved.length}, unknown ids: ${result.missing.join(", ") || "none"}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
