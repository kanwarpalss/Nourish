/**
 * Nourish is served over plain HTTP on a private Tailscale IP, by design: no
 * public ingress means no TLS. Browsers therefore treat it as an INSECURE
 * context, and a whole family of Web APIs silently does not exist there.
 *
 * On 2026-08-30 exactly that crashed Log Food to a blank page on every real
 * device, for weeks, because `crypto.randomUUID()` was called during render.
 * It survived every test because tests and local development both ran on
 * `localhost` — the one origin browsers exempt from the secure-context rule.
 *
 * These tests exist so that can never happen again: one proves the id helpers
 * work with the API removed, the other refuses to let any secure-context-only
 * API back into the client source at all.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { freshTrayId, freshUnique, randomHex } from "../app/ids";

/**
 * Runs `body` with parts of the Web Crypto API removed, exactly as an insecure
 * context presents them, then always restores the real one.
 */
function withCrypto(replacement: Crypto | undefined, body: () => void) {
  const real = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", { value: replacement, configurable: true, writable: true });
    body();
  } finally {
    Object.defineProperty(globalThis, "crypto", { value: real, configurable: true, writable: true });
  }
}

test("ids still generate when randomUUID does not exist, as on every real device", () => {
  const withoutRandomUUID = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) } as unknown as Crypto;
  withCrypto(withoutRandomUUID, () => {
    assert.equal("randomUUID" in globalThis.crypto, false, "precondition: randomUUID must be absent for this test to mean anything");
    assert.match(freshUnique(), /^[0-9a-f]{12}$/);
    assert.match(freshTrayId(), /^[0-9a-f]{32}$/);
  });
});

test("ids still generate when Web Crypto is missing entirely", () => {
  withCrypto(undefined, () => {
    assert.equal(globalThis.crypto, undefined);
    assert.match(freshUnique(), /^[0-9a-f]{12}$/);
    assert.match(freshTrayId(), /^[0-9a-f]{32}$/);
  });
});

test("ids do not collide across a realistic burst of logging", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 20_000; index += 1) seen.add(freshUnique());
  assert.equal(seen.size, 20_000, "a repeated id silently merges two different diary entries");
});

test("randomHex returns the requested length and only hex", () => {
  assert.equal(randomHex(0), "");
  assert.equal(randomHex(1).length, 2);
  assert.equal(randomHex(32).length, 64);
  assert.match(randomHex(8), /^[0-9a-f]+$/);
});

/**
 * Web APIs that exist on localhost and HTTPS but NOT on Nourish's real
 * plain-HTTP origin. Any one of these reaching the client is the 2026-08-30
 * blank-screen bug again, wearing a different hat.
 */
const SECURE_CONTEXT_ONLY = [
  "crypto.randomUUID",
  "crypto.subtle",
  "navigator.clipboard",
  "navigator.share",
  "navigator.mediaDevices",
  "getUserMedia",
  "navigator.serviceWorker",
  "navigator.geolocation",
  "navigator.storage",
  "navigator.bluetooth",
  "navigator.usb",
  "navigator.wakeLock",
  "showSaveFilePicker",
  "showOpenFilePicker",
];

/** Strips comments and string literals so prose *about* these APIs is allowed. */
function executableSourceOnly(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

async function clientSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return clientSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test("no secure-context-only Web API reaches the client source", async () => {
  const root = new URL("../app/", import.meta.url).pathname;
  const files = await clientSourceFiles(root);
  assert.ok(files.length > 5, "expected to actually find the app source");

  const offences: string[] = [];
  for (const file of files) {
    const code = executableSourceOnly(await readFile(file, "utf8"));
    for (const api of SECURE_CONTEXT_ONLY) {
      if (code.includes(api)) offences.push(`${file.replace(root, "app/")} uses ${api}`);
    }
  }

  assert.deepEqual(offences, [], [
    "These APIs do not exist on Nourish's plain-HTTP Tailscale origin and will crash or",
    "silently fail on every real device, while still working perfectly on localhost.",
    "Use a non-secure-context equivalent — for ids, app/ids.ts.",
  ].join("\n"));
});
