/**
 * Publish a Nourish release: build, freeze a snapshot, swap it in, prove it
 * works — and put the old one back if it doesn't.
 *
 * Usage:
 *   npm run release              build, publish, restart, verify
 *   npm run release -- --no-build   publish the current dist/ without rebuilding
 *
 * Why a snapshot rather than serving dist/ directly: dist/ is rewritten by
 * every build and every test run, which used to silently break the live app.
 * A release is a frozen copy; only this script ever changes what is being
 * served.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkNourishHealth } from "./health.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releasesDir = path.join(repoRoot, "releases");
const currentLink = path.join(releasesDir, "current");
const SERVICE = "com.kanwar.nourish";
const KEEP_RELEASES = 5;
const HEALTH_TIMEOUT_MS = 60_000;

const skipBuild = process.argv.includes("--no-build");

function fail(message, detail) {
  console.error(`\nRelease stopped: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function step(message) {
  console.log(`\n${message}`);
}

/** The release currently being served, or null if there isn't one. */
function currentReleasePath() {
  try {
    return fs.realpathSync(currentLink);
  } catch {
    return null;
  }
}

/** Point releases/current at a directory without ever leaving it missing. */
function pointCurrentAt(releaseDir) {
  const staging = path.join(releasesDir, `.current-${process.pid}`);
  fs.rmSync(staging, { force: true });
  fs.symlinkSync(releaseDir, staging, "dir");
  fs.renameSync(staging, currentLink); // atomic replace
}

function serviceIsLoaded() {
  const result = spawnSync("launchctl", ["print", `gui/${os.userInfo().uid}/${SERVICE}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function restartService() {
  const result = spawnSync("launchctl", ["kickstart", "-k", `gui/${os.userInfo().uid}/${SERVICE}`], {
    stdio: "inherit",
  });
  return result.status === 0;
}

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let report = { healthy: false, problems: ["the check never ran"], assetsChecked: 0 };
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    report = await checkNourishHealth();
    if (report.healthy) return report;
  }
  return report;
}

// ---------------------------------------------------------------- build

if (!skipBuild) {
  step("Building Nourish...");
  const build = spawnSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  if (build.status !== 0) {
    fail("the build failed, so nothing was published. The app you are running is untouched.");
  }
}

const distDir = path.join(repoRoot, "dist");
if (!fs.existsSync(path.join(distDir, "client", "assets")) || !fs.existsSync(path.join(distDir, "server"))) {
  fail("the built files in dist/ look incomplete, so nothing was published.", "Try: npm run build");
}

// ---------------------------------------------------------------- snapshot

const previousRelease = currentReleasePath();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = path.join(releasesDir, stamp);

step(`Freezing a snapshot as releases/${stamp} ...`);
fs.mkdirSync(releaseDir, { recursive: true });
fs.cpSync(distDir, path.join(releaseDir, "dist"), { recursive: true });

// vinext reads these from its working directory.
for (const name of ["package.json", "next.config.ts"]) {
  const source = path.join(repoRoot, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(releaseDir, name));
}
for (const name of fs.readdirSync(repoRoot).filter((f) => f.startsWith(".env"))) {
  fs.copyFileSync(path.join(repoRoot, name), path.join(releaseDir, name));
}
// Dependencies are shared with the repo rather than copied — they are not what
// changes between releases, and copying them would cost hundreds of megabytes.
fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(releaseDir, "node_modules"), "dir");

// ---------------------------------------------------------------- swap

step("Switching Nourish to the new release...");
pointCurrentAt(releaseDir);

if (!serviceIsLoaded()) {
  console.log(
    `\nThe new release is published, but the ${SERVICE} service is not loaded, so nothing was restarted.`,
  );
  console.log("Start it yourself with:  npm run serve");
  process.exit(0);
}

if (!restartService()) {
  fail("the service would not restart.", `Check the log at ~/Library/Logs/Nourish-error.log`);
}

// ---------------------------------------------------------------- verify

step("Checking that the app actually works...");
const report = await waitForHealth();

if (report.healthy) {
  step(`Nourish is live and healthy — page plus all ${report.assetsChecked} code files load correctly.`);
  console.log("   http://localhost:3902");

  // Keep a few releases so a rollback is always possible.
  const olderReleases = fs
    .readdirSync(releasesDir)
    .filter((name) => name !== "current" && !name.startsWith("."))
    .sort()
    .slice(0, -KEEP_RELEASES);
  for (const name of olderReleases) {
    fs.rmSync(path.join(releasesDir, name), { recursive: true, force: true });
  }
  process.exit(0);
}

// ---------------------------------------------------------------- rollback

console.error("\nThe new release did not come up healthy:");
for (const problem of report.problems) console.error(`  - ${problem}`);

if (!previousRelease) {
  fail("there is no earlier release to fall back to, so Nourish is left stopped.");
}

step(`Putting the previous release back (${path.basename(previousRelease)})...`);
pointCurrentAt(previousRelease);
restartService();
const rolledBack = await waitForHealth();

if (rolledBack.healthy) {
  console.error("\nRolled back. Nourish is working again on the previous release.");
  console.error("The new build was NOT published. Fix the problem above and run npm run release again.");
} else {
  console.error("\nThe rollback did not come up healthy either. Nourish needs a look:");
  for (const problem of rolledBack.problems) console.error(`  - ${problem}`);
}
process.exit(1);
