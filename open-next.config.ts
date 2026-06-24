import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default OpenNext-on-Cloudflare config. Add caching (R2/KV incremental cache,
// D1 tag cache) here later as the app grows.
export default defineCloudflareConfig();
