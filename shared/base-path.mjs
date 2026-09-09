/**
 * The one place Nourish's URL prefix is written down.
 *
 * The app is served behind the Mac Mini's Caddy reverse proxy at /nourish.
 * Both the TypeScript app (next.config.ts, app/diary-api.ts) and the plain
 * Node front door (server/front-door.mjs) import this, so the prefix can
 * never drift between the page and the API it calls.
 */
export const BASE_PATH = "/nourish";
