import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Visited pages are reused for 60 s when you navigate back to them (no
    // refetch, no skeleton). Every change clears this cache at once: server
    // actions call updateTag (lib/cache/invalidate), API-route changes call
    // the syncAfterChange action (lib/client/sync), sign-in/out is a full load.
    staleTimes: { dynamic: 60, static: 300 },
  },
  cacheComponents: true,
  // The invoice views used to be separate pages; they're tabs on /invoices now.
  // Old links and bookmarks land on the right tab (their query string comes along).
  async redirects() {
    return [
      { source: "/invoices/drafts", destination: "/invoices?view=draft", permanent: false },
      { source: "/invoices/sent", destination: "/invoices?view=sent", permanent: false },
      { source: "/invoices/overdue", destination: "/invoices?view=overdue", permanent: false },
      { source: "/invoices/paid", destination: "/invoices?view=paid", permanent: false },
    ];
  },
  // The dev badge sat on top of the editor's Send button; errors still show.
  devIndicators: false,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
