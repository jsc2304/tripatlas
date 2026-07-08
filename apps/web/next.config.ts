import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cookie-basiertes i18n ohne Locale-Routing: die Request-Config liest die
// aktive Sprache aus dem Cookie und lädt die passenden Message-Namespaces.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root explicitly: an unrelated lockfile in the user's
  // home directory otherwise makes Next.js misdetect the monorepo root.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default withNextIntl(nextConfig);
