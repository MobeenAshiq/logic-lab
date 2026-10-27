import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // The browser only talks to this app. /api/* is proxied to the NestJS API, so
  // auth cookies are first-party and middleware.ts can read them.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/:path*` },
      { source: "/socket.io/:path*", destination: `${API_URL}/socket.io/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
