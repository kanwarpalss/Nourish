/**
 * Honest health check for Nourish.
 *
 * A 200 on "/" is NOT proof the app works. Nourish renders its page on the
 * server and then hands the browser a list of JavaScript files by name. If the
 * server is serving a page from an older build, those names point at files that
 * no longer exist: the page paints perfectly and then nothing is clickable.
 *
 * So this check does what a browser does — fetch the page, then fetch every
 * asset the page asks for (and every asset those assets ask for, one level
 * deeper, to catch lazily loaded chunks). Any missing or empty file is a
 * failure, in plain English.
 */

import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:3902";
const REQUEST_TIMEOUT_MS = 5000;

/** Matches the hashed build assets Nourish serves, e.g. /assets/index-DPuT0EBM.js */
const ASSET_PATTERN = /\/assets\/[A-Za-z0-9_\-.]+\.(?:js|css)/g;

function findAssetPaths(text) {
  return [...new Set(text.match(ASSET_PATTERN) ?? [])];
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one asset and judge it. Returns null when healthy, or a plain-English
 * problem string when not.
 */
async function inspectAsset(baseUrl, assetPath) {
  let result;
  try {
    result = await fetchWithTimeout(new URL(assetPath, baseUrl));
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timed out" : "could not be fetched";
    return `${assetPath} ${reason} — the server closed the connection instead of serving it.`;
  }

  if (result.status === 404) {
    return `${assetPath} is missing (404) — the page is asking for a file from a different build.`;
  }
  if (!result.ok) {
    return `${assetPath} returned status ${result.status}.`;
  }
  if (result.body.length === 0) {
    return `${assetPath} came back empty — the browser gets no code, so the page cannot respond to clicks.`;
  }
  return null;
}

/**
 * Check a running Nourish. Resolves to a report; never throws for an unhealthy
 * app, only for programming errors.
 *
 * @param {string} baseUrl origin to check, e.g. "http://127.0.0.1:3902"
 * @returns {Promise<{healthy: boolean, problems: string[], assetsChecked: number}>}
 */
export async function checkNourishHealth(baseUrl = DEFAULT_BASE_URL) {
  let page;
  try {
    page = await fetchWithTimeout(new URL("/", baseUrl));
  } catch (error) {
    const reason = error?.name === "AbortError" ? "did not answer in time" : "is not answering";
    return {
      healthy: false,
      problems: [`Nourish ${reason} at ${baseUrl} — the service is down or still starting.`],
      assetsChecked: 0,
    };
  }

  if (!page.ok) {
    return {
      healthy: false,
      problems: [`Nourish answered with status ${page.status} instead of serving its page.`],
      assetsChecked: 0,
    };
  }

  const pageAssets = findAssetPaths(page.body);
  if (pageAssets.length === 0) {
    return {
      healthy: false,
      problems: [
        "Nourish served a page that references no JavaScript at all — the build looks incomplete, so nothing on the page would work.",
      ],
      assetsChecked: 0,
    };
  }

  // First level: everything the page itself names.
  const problems = [];
  const checked = new Set(pageAssets);
  const bodies = [];

  for (const assetPath of pageAssets) {
    const problem = await inspectAsset(baseUrl, assetPath);
    if (problem) {
      problems.push(problem);
    } else if (assetPath.endsWith(".js")) {
      bodies.push(await fetchWithTimeout(new URL(assetPath, baseUrl)).then((r) => r.body));
    }
  }

  // Second level: chunks named only from inside those files (lazy imports).
  const nested = new Set();
  for (const body of bodies) {
    for (const assetPath of findAssetPaths(body)) {
      if (!checked.has(assetPath)) nested.add(assetPath);
    }
  }
  for (const assetPath of nested) {
    checked.add(assetPath);
    const problem = await inspectAsset(baseUrl, assetPath);
    if (problem) problems.push(problem);
  }

  return { healthy: problems.length === 0, problems, assetsChecked: checked.size };
}

async function main() {
  const baseUrl = process.argv[2] ?? DEFAULT_BASE_URL;
  const report = await checkNourishHealth(baseUrl);

  if (report.healthy) {
    console.log(
      `Nourish is healthy — its page and all ${report.assetsChecked} of its code files load correctly at http://localhost:3902`,
    );
    return;
  }

  console.error("Nourish is NOT healthy. The page may look fine but not respond to clicks.\n");
  for (const problem of report.problems) {
    console.error(`  - ${problem}`);
  }
  console.error("\nMost likely cause: the app was rebuilt while the service kept running.");
  console.error("Fix it with:  npm run release");
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
