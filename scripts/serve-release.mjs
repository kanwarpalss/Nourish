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

/**
 * The app renders on an internal port and the front door owns 4317.
 *
 * The diary API has to be same-origin with the page: a separate port would mean
 * CORS, and once the Mac Mini serves HTTPS a page on https:// calling http:// on
 * another port is blocked outright as mixed content. Fronting both on one port
 * side-steps all of it, and keeps 4317 the only port Nourish ever occupies.
 */
const INTERNAL_APP_PORT = 4316;
const PUBLIC_PORT = 4317;

const child = spawn(vinextBin, ["start", "--port", String(INTERNAL_APP_PORT), "--hostname", "127.0.0.1"], {
  cwd: releaseDir,
  stdio: "inherit",
  env: { ...process.env, WRANGLER_LOG_PATH: path.join(repoRoot, ".wrangler", "wrangler.log") },
});

const { startFrontDoor } = await import(new URL("../server/front-door.mjs", import.meta.url).href);
const frontDoor = await startFrontDoor({
  port: PUBLIC_PORT,
  host: "0.0.0.0",
  appOrigin: `http://127.0.0.1:${INTERNAL_APP_PORT}`,
});
console.log(`Nourish is answering on http://0.0.0.0:${PUBLIC_PORT} (diary database at ${frontDoor.databasePath})`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
    frontDoor.close();
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
