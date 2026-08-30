/**
 * Every id Nourish generates, in one place.
 *
 * Why this module exists: `crypto.randomUUID()` only exists in a browser
 * "secure context" — HTTPS, or the special-cased `localhost`. Nourish is
 * reached over plain HTTP on a private Tailscale IP by design (no public
 * ingress, so no TLS), so every real device — phone, laptop via the terminal
 * alias, the Mac Mini itself — loads an *insecure* context where
 * `randomUUID` is silently `undefined`. Calling it during render crashed the
 * whole React root to a blank page (fixed 2026-08-30).
 *
 * It went unnoticed for weeks because it was only ever tested on
 * `localhost`, which is the one origin browsers exempt from that rule.
 *
 * `crypto.getRandomValues()` carries no secure-context restriction, so it is
 * the only randomness source this app may use. `tests/insecure-context.test.ts`
 * enforces that by scanning source, and proves these functions still work with
 * `randomUUID` — and `crypto` entirely — removed.
 */

/** Random lowercase hex, `byteLength * 2` characters long. */
export function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  const source = globalThis.crypto;
  if (source?.getRandomValues) source.getRandomValues(bytes);
  // Last-resort fallback: an ancient or stripped-down browser with no Web
  // Crypto at all. Weaker randomness is still far better than a blank screen,
  // and these ids are local diary keys, never security tokens.
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A short id for a logged entry, custom food, Meal, or tray line. */
export function freshUnique() {
  return randomHex(6);
}

/** A longer id for tray lines, which are created rapidly in a single session. */
export function freshTrayId() {
  return randomHex(16);
}
