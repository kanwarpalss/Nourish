import type { NextConfig } from "next";
import { BASE_PATH } from "./shared/base-path.mjs";

const nextConfig: NextConfig = {
  // Served behind the Mac Mini's Caddy reverse proxy at /nourish, so every
  // link and asset the app emits needs the prefix baked in. Stripping the
  // prefix at the proxy instead only ever works for the landing page.
  basePath: BASE_PATH,
};

export default nextConfig;
