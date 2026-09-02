/**
 * Failure-injection tests for the Nourish health check (TEST-12).
 *
 * A health check that only ever passes is worse than none at all — it was
 * `curl / >/dev/null` returning green while the app sat frozen on screen that
 * made this whole class of bug invisible. These tests deliberately break the
 * app in each way it has actually broken, and assert the check goes RED.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { checkNourishHealth, healthyMessage } from "../scripts/health.mjs";

const ENTRY = "/assets/index-TESTHASH.js";
const LAZY = "/assets/lazy-CHUNKHASH.js";

test("the success message names the address that was actually checked", () => {
  const tailscaleUrl = "http://100.81.29.11:3902";
  const message = healthyMessage(tailscaleUrl, 6);
  assert.match(message, new RegExp(tailscaleUrl.replaceAll(".", "\\.")));
  assert.doesNotMatch(message, /localhost/);
});

function pageHtml(assetPath = ENTRY) {
  return `<!doctype html><html><head><link rel="modulepreload" href="${assetPath}"></head><body><div id="root">Nourish</div><script type="module" src="${assetPath}"></script></body></html>`;
}

/** Start a throwaway server whose behaviour we control per-request. */
async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("a correctly served app reports healthy", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end(pageHtml());
      if (req.url === ENTRY) return res.end("console.log('real app code')");
      res.statusCode = 404;
      res.end();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, true, report.problems.join("; "));
      assert.equal(report.assetsChecked, 1);
    },
  );
});

test("THE REAL BUG: page served from an older build, asset now missing", async () => {
  // Exactly what happened on 2026-08-14: "/" returns 200, so the old health
  // check passed, while the JavaScript it names had been deleted by a rebuild.
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end(pageHtml());
      res.statusCode = 404;
      res.end();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, false);
      assert.match(report.problems.join(" "), /missing \(404\)/);
    },
  );
});

test("an asset that returns 200 but empty is caught", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end(pageHtml());
      if (req.url === ENTRY) return res.end(""); // 200, zero bytes
      res.statusCode = 404;
      res.end();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, false);
      assert.match(report.problems.join(" "), /came back empty/);
    },
  );
});

test("a connection closed mid-asset is caught", async () => {
  // This is what the browser saw as ERR_EMPTY_RESPONSE.
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end(pageHtml());
      res.socket.destroy();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, false);
      assert.match(report.problems.join(" "), /could not be fetched|timed out/);
    },
  );
});

test("a lazily loaded chunk named only inside the JavaScript is checked too", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end(pageHtml());
      if (req.url === ENTRY) return res.end(`import("${LAZY}")`);
      res.statusCode = 404; // the lazy chunk is gone
      res.end();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, false, "second-level chunks must be checked");
      assert.match(report.problems.join(" "), new RegExp(LAZY.replace(/[/.]/g, "\\$&")));
    },
  );
});

test("a page referencing no JavaScript at all is not called healthy", async () => {
  await withServer(
    (req, res) => {
      if (req.url === "/") return res.end("<!doctype html><html><body>Nourish</body></html>");
      res.statusCode = 404;
      res.end();
    },
    async (baseUrl) => {
      const report = await checkNourishHealth(baseUrl);
      assert.equal(report.healthy, false);
      assert.match(report.problems.join(" "), /references no JavaScript/);
    },
  );
});

test("a service that is not running is reported as down, not healthy", async () => {
  // Bind and immediately release a port so we know nothing is listening there.
  const port = await withServer(
    (_req, res) => res.end(),
    async (baseUrl) => new URL(baseUrl).port,
  );
  const report = await checkNourishHealth(`http://127.0.0.1:${port}`);
  assert.equal(report.healthy, false);
  assert.match(report.problems.join(" "), /not answering|did not answer/);
});
