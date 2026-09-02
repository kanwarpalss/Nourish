/**
 * Development: the app on 3902, the diary database beside it on 4319.
 *
 * Vite proxies /api/nourish through to the data service (see vite.config.ts), so
 * the browser talks to one origin in development exactly as it does in production.
 * Running the service in this process rather than a second terminal means there is
 * no way to start the app and forget the database.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDiaryService } from "../server/diary-service.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPort = Number(process.env.NOURISH_DATA_PORT ?? 4319);

const service = await startDiaryService({ port: dataPort, host: "127.0.0.1" });
console.log(`Diary database ready on 127.0.0.1:${dataPort} (${service.store.path})`);

const child = spawn(path.join(repoRoot, "node_modules", ".bin", "vinext"), ["dev", "--port", "3902", "--hostname", "0.0.0.0"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, WRANGLER_LOG_PATH: path.join(repoRoot, ".wrangler", "wrangler.log") },
});

const shutdown = (signal) => {
  child.kill(signal);
  service.server.closeAllConnections();
  service.server.close();
  service.store.close();
};

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(signal));

child.on("exit", (code, signal) => {
  service.server.closeAllConnections();
  service.server.close();
  service.store.close();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
