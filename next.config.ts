import type { NextConfig } from "next";

const backendProxyTarget =
  process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  images: {
    remotePatterns: [
      // Local backend dev server
      { protocol: "http", hostname: "127.0.0.1", port: "4000" },
      { protocol: "http", hostname: "localhost", port: "4000" },
      // Production / Render deploy
      { protocol: "https", hostname: "**.onrender.com" },
      { protocol: "https", hostname: "**.vercel.app" },
      // Any custom domain (catch-all for uploads CDN)
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    const raw =
      process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/$/, "") ||
      (process.env.NODE_ENV === "production"
        ? "https://prime-detailers-website.vercel.app"
        : "http://localhost:3003");
    const marketing =
      /^https?:\/\/(www\.)?mydetailos\.com$/i.test(raw)
        ? "https://prime-detailers-website.vercel.app"
        : raw;
    return [
      { source: "/signup", destination: `${marketing}/signup`, permanent: false },
      { source: "/register", destination: `${marketing}/signup`, permanent: false },
      { source: "/pricing", destination: `${marketing}/pricing`, permanent: false },
      { source: "/features", destination: `${marketing}/features`, permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendProxyTarget}/api/:path*`,
      },
      {
        source: "/backend-uploads/:path*",
        destination: `${backendProxyTarget}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
