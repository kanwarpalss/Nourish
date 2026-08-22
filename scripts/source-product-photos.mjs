/**
 * Retired: retailer URLs and pack designs change independently. A generic page
 * scrape once mapped a different Amul pack size and could silently fill a blank
 * product photo. Exact branded photos now require a manual brand + product +
 * flavour + pack-size check against the current catalogue record.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RETIRED_REASON = "Automatic product-photo scraping is retired; verify the exact current pack manually before adding an image.";

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  console.error(RETIRED_REASON);
  process.exitCode = 1;
}
