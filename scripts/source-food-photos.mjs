/**
 * Retired: free-text image search cannot prove the pictured ingredient has the
 * catalogue's exact raw/cooked form. It previously produced plausible-looking
 * candidates that were unsafe to apply without manual visual review.
 *
 * Use source-wikipedia-photos.mjs for its small allow-list of visually
 * unambiguous generic ingredients. Leave every other item on its drawn icon.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RETIRED_REASON = "Free-text food photo search is retired; use the curated Wikipedia allow-list and visually review every result.";

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  console.error(RETIRED_REASON);
  process.exitCode = 1;
}
