/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Enables Cloudflare bindings (D1, R2, env) during `next dev`.
// See: https://opennext.js.org/cloudflare
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
