/**
 * The cardIQ import silently never ran on the Mac Mini: the snapshot file is
 * gitignored (it holds real order history), so nobody generating it there
 * meant Purchases 404'd on the live service for as long as it existed, with
 * no error anywhere — the app's own honest-empty-state design made the gap
 * invisible instead of loud. Fixed by refreshing the snapshot as a release
 * step. These assertions can't run the real script (it builds and restarts a
 * live launchd service), so they check the source directly, the same
 * approach tests/rendered-html.test.mjs uses for other ops scripts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("release.mjs refreshes the cardIQ snapshot before building, and never aborts the release if it fails", async () => {
  const source = await readFile(new URL("../scripts/release.mjs", import.meta.url), "utf8");

  const cardIqIndex = source.indexOf("import:cardiq");
  const buildIndex = source.indexOf('"Building Nourish...');
  assert.ok(cardIqIndex > -1, "release must refresh the cardIQ snapshot");
  assert.ok(buildIndex > -1, "release must still build");
  assert.ok(
    cardIqIndex < buildIndex,
    "the cardIQ refresh must run before the build, so a fresh snapshot in public/ is what the build copies into dist/client/",
  );

  // The refresh sits inside the same `if (!skipBuild)` guard as the build step,
  // so `--no-build` (publish the current dist/ as-is) does not silently rewrite
  // public/ without rebuilding to match.
  const cardIqBlock = source.slice(source.lastIndexOf("if (!skipBuild)", cardIqIndex), buildIndex);
  assert.match(cardIqBlock, /if \(!skipBuild\)/, "the cardIQ refresh must respect --no-build like the build step does");

  // A failed import (missing credentials, network) must warn loudly (EDGE-03)
  // but never call fail()/process.exit — Purchases already has an honest empty
  // state, so losing cardIQ data for one release is not worth stopping the
  // release that fixes something else entirely.
  const afterCardIq = source.slice(cardIqIndex, buildIndex);
  assert.match(afterCardIq, /cardIqImport\.status !== 0/, "must check whether the import actually succeeded");
  assert.match(afterCardIq, /console\.warn/, "a failed import must warn loudly, not fail silently");
  assert.doesNotMatch(afterCardIq, /\bfail\(/, "a failed cardIQ import must not abort the release");
});
