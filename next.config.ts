import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

// Makes Cloudflare bindings (D1, KV, R2, Email) reachable during `next dev`.
// See: https://opennext.js.org/cloudflare
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
