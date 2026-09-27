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
import { createDiaryHandler, ensureFirstProfile, schedulePhotoSweep } from "./diary-service.mjs";
import { API_PREFIX, BASE_PATH, DIARY_API_BASE } from "../shared/base-path.mjs";

export async function startFrontDoor({ port = 3902, host = "0.0.0.0", appOrigin, databasePath } = {}) {
  const store = openDiaryStore(databasePath);
  ensureFirstProfile(store);
  schedulePhotoSweep(store);
  const handleDiary = createDiaryHandler(store);
  const upstream = new URL(appOrigin);

  const server = createServer((clientRequest, clientResponse) => {
    const rawUrl = clientRequest.url ?? "";
    const requestUrl = new URL(rawUrl, "http://internal");

    // The bare origin (http://mac-mini:3902/) has nothing to serve once the
    // app lives under a base path, so send it into the app rather than
    // letting it 404. Deliberately NOT redirecting to BASE_PATH + "/":
    // the framework 308s that back to the slashless form, and the pair
    // becomes an infinite loop.
    if (rawUrl === "/") {
      clientResponse.writeHead(302, { location: BASE_PATH });
      clientResponse.end();
      return;
    }

    // The page calls the diary API under the base path
    // (/nourish/api/nourish/...) because DIARY_API_BASE carries the prefix.
    // A direct hit on the port still uses the bare /api/nourish. Accept both
    // and hand the diary handler the bare form it was written against.
    const prefixedApi = requestUrl.pathname.startsWith(`${DIARY_API_BASE}/`);
    const directApi = requestUrl.pathname.startsWith(`${API_PREFIX}/`);
    if (prefixedApi || directApi) {
      if (prefixedApi) clientRequest.url = rawUrl.slice(BASE_PATH.length);
      handleDiary(clientRequest, clientResponse).catch((error) => {
        console.error("[nourish] diary request failed:", error);
        if (!clientResponse.headersSent) {
          clientResponse.writeHead(500, { "content-type": "application/json" });
          clientResponse.end(JSON.stringify({ error: "The diary database failed." }));
        }
      });
      return;
    }

    // vinext currently honours basePath when it writes asset/public URLs into
    // the HTML, but its production server still exposes those files at the
    // unprefixed paths. Translate only the known static-file routes here; app
    // navigation must keep /nourish so the framework can route it correctly.
    // Slice the original URL rather than rebuilding it so query strings survive.
    const isPrefixedStaticDirectory = ["assets", "food-images"].some((directory) =>
      requestUrl.pathname.startsWith(`${BASE_PATH}/${directory}/`),
    );
    const isPrefixedPublicFile = new Set([
      `${BASE_PATH}/favicon.svg`,
      `${BASE_PATH}/file.svg`,
      `${BASE_PATH}/globe.svg`,
      `${BASE_PATH}/window.svg`,
      `${BASE_PATH}/cardiq-food-import.json`,
    ]).has(requestUrl.pathname);
    const upstreamPath = isPrefixedStaticDirectory || isPrefixedPublicFile
      ? rawUrl.slice(BASE_PATH.length)
      : rawUrl;

    const proxied = httpRequest(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: upstreamPath,
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
