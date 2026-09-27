import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { startFrontDoor } from "../server/front-door.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function withFrontDoor(run) {
  const seen = [];
  const upstream = http.createServer((request, response) => {
    seen.push(request.url);
    if (request.url === "/nourish/") {
      response.writeHead(308, { location: "/nourish" });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(request.url);
  });
  const upstreamPort = await listen(upstream);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nourish-front-door-"));
  const frontDoor = await startFrontDoor({
    port: 0,
    host: "127.0.0.1",
    appOrigin: `http://127.0.0.1:${upstreamPort}`,
    databasePath: path.join(directory, "diary.db"),
  });
  const baseUrl = `http://127.0.0.1:${frontDoor.server.address().port}`;

  try {
    await run({ baseUrl, seen });
  } finally {
    frontDoor.close();
    await close(upstream);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("the front door rewrites build assets but preserves basePath-prefixed public files", async () => {
  await withFrontDoor(async ({ baseUrl, seen }) => {
    const cases = [
      ["/nourish/assets/app-HASH.js?build=7&build=8", "/assets/app-HASH.js?build=7&build=8"],
      ["/nourish/assets/theme-HASH.css?name=light%20mode", "/assets/theme-HASH.css?name=light%20mode"],
      ["/nourish/food-images/thick%20poha.jpg?width=640", "/nourish/food-images/thick%20poha.jpg?width=640"],
      ["/nourish/favicon.svg?v=2", "/nourish/favicon.svg?v=2"],
      ["/nourish/cardiq-food-import.json?fresh=1", "/nourish/cardiq-food-import.json?fresh=1"],
    ];

    for (const [requested, expectedUpstream] of cases) {
      const response = await fetch(baseUrl + requested);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), expectedUpstream);
    }
    assert.deepEqual(seen, cases.map(([, expected]) => expected));
  });
});

test("the front door does not strip lookalikes, app routes, or prefix text without a path boundary", async () => {
  await withFrontDoor(async ({ baseUrl, seen }) => {
    const untouched = [
      "/nourish",
      "/nourish/history?range=30d",
      "/nourish/assets-not-real/app.js",
      "/nourishment/assets/app.js",
    ];

    for (const requested of untouched) {
      const response = await fetch(baseUrl + requested);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), requested);
    }
    assert.deepEqual(seen, untouched);
  });
});

test("both direct and base-path diary health routes stay inside the front door", async () => {
  await withFrontDoor(async ({ baseUrl, seen }) => {
    for (const endpoint of ["/api/nourish/health", "/nourish/api/nourish/health"]) {
      const response = await fetch(baseUrl + endpoint);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
    }
    assert.deepEqual(seen, [], "diary API requests must never leak to the rendering server");
  });
});

test("API matching requires the complete /api/nourish path segment", async () => {
  await withFrontDoor(async ({ baseUrl, seen }) => {
    const nearMisses = [
      "/api/nourishment/health?probe=1",
      "/api/nourish-old/health?probe=2",
      "/nourish/api/nourishment/health?probe=3",
    ];

    for (const requested of nearMisses) {
      const response = await fetch(baseUrl + requested);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), requested);
    }
    assert.deepEqual(seen, nearMisses);
  });
});

test("the root redirect and framework trailing-slash redirect cannot form a loop", async () => {
  await withFrontDoor(async ({ baseUrl, seen }) => {
    const root = await fetch(baseUrl + "/", { redirect: "manual" });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/nourish");
    assert.deepEqual(seen, [], "the bare root must not reach vinext");

    const trailingSlash = await fetch(baseUrl + "/nourish/", { redirect: "manual" });
    assert.equal(trailingSlash.status, 308);
    assert.equal(trailingSlash.headers.get("location"), "/nourish");
    assert.deepEqual(seen, ["/nourish/"], "page routes must keep their prefix upstream");
  });
});

test("development proxies the same prefixed diary route and removes only the app base path", async () => {
  const source = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(source, /\[DIARY_API_BASE\]:\s*\{/);
  assert.match(source, /rewrite:\s*\(requestPath\)\s*=>\s*requestPath\.slice\(BASE_PATH\.length\)/);
  assert.doesNotMatch(source, /["']\/api\/nourish["']:\s*\{/);
});
