/**
 * One port for the whole of Nourish.
 *
 * Requests under /api/nourish are answered here from SQLite; everything else is
 * passed through to the app rendering on an internal port. Keeping both behind a
 * single origin is what lets the browser call the diary API with a plain relative
 * path — no CORS, and no mixed-content wall the day the Mac Mini serves HTTPS.
 *
 * There is no WebSocket handling because production has none: the dev server's
 * hot reload is the only thing that needs upgrades, and `npm run dev` proxies
 * through Vite instead of this.
 */

import { createServer, request as httpRequest } from "node:http";
import { openDiaryStore } from "./diary-store.mjs";
import { createDiaryHandler, ensureFirstProfile, API_PREFIX } from "./diary-service.mjs";

export async function startFrontDoor({ port = 4317, host = "0.0.0.0", appOrigin, databasePath } = {}) {
  const store = openDiaryStore(databasePath);
  ensureFirstProfile(store);
  const handleDiary = createDiaryHandler(store);
  const upstream = new URL(appOrigin);

  const server = createServer((clientRequest, clientResponse) => {
    if ((clientRequest.url ?? "").startsWith(API_PREFIX)) {
      handleDiary(clientRequest, clientResponse).catch((error) => {
        console.error("[nourish] diary request failed:", error);
        if (!clientResponse.headersSent) {
          clientResponse.writeHead(500, { "content-type": "application/json" });
          clientResponse.end(JSON.stringify({ error: "The diary database failed." }));
        }
      });
      return;
    }

    const proxied = httpRequest(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: clientRequest.url,
        method: clientRequest.method,
        headers: clientRequest.headers,
      },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(clientResponse);
      },
    );

    proxied.on("error", (error) => {
      // The app is still booting, or has died. Say so plainly rather than hanging:
      // a blank page with no explanation is the worst version of this.
      console.error("[nourish] the app did not answer:", error.message);
      if (!clientResponse.headersSent) {
        clientResponse.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        clientResponse.end("Nourish is starting up. Refresh in a moment.\n");
      } else clientResponse.end();
    });

    clientRequest.pipe(proxied);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  return {
    server,
    store,
    databasePath: store.path,
    close() {
      server.closeAllConnections();
      server.close();
      store.close();
    },
  };
}
