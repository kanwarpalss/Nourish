/**
 * Serve the promoted Nourish release, never the working build.
 *
 * This is the whole point of the release-snapshot design. `npm run build` and
 * `npm test` both rewrite dist/ with freshly named files and delete the old
 * ones. When the running service served straight out of dist/, that meant
 * running the tests silently broke the live app: the page still loaded, but the
 * JavaScript it named had just been deleted, so nothing was clickable.
 *
 * The service now serves releases/current, a frozen copy that only
 * `npm run release` ever changes. Building and testing cannot touch it.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentRelease = path.join(repoRoot, "releases", "current");

if (!fs.existsSync(currentRelease)) {
  console.error("Nourish has no published release yet, so there is nothing to serve.");
  console.error("Publish one with:  npm run release");
  process.exit(1);
}

const releaseDir = fs.realpathSync(currentRelease);

if (!fs.existsSync(path.join(releaseDir, "dist", "client", "assets"))) {
  console.error(`The published release at ${releaseDir} looks incomplete — its built files are missing.`);
  console.error("Publish a fresh one with:  npm run release");
  process.exit(1);
}

console.log(`Nourish is serving release ${path.basename(releaseDir)}`);

// Run vinext from the repo's install, but with the release directory as the
// working directory — vinext serves whatever sits at <cwd>/dist.
const vinextBin = path.join(repoRoot, "node_modules", ".bin", "vinext");

const child = spawn(vinextBin, ["start", "--port", "4317", "--hostname", "0.0.0.0"], {
  cwd: releaseDir,
  stdio: "inherit",
  env: { ...process.env, WRANGLER_LOG_PATH: path.join(repoRoot, ".wrangler", "wrangler.log") },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
