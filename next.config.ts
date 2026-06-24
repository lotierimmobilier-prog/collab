import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",  // Next.js HMR + GIS
  "style-src 'self' 'unsafe-inline'",                       // styles inline React
  "img-src 'self' data: https:",                            // images distantes (avatars, logos)
  "font-src 'self' data:",
  "connect-src 'self' https://api.anthropic.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://gmail.googleapis.com", // IA + Google OAuth + Gmail API
  "frame-ancestors 'none'",                                 // anti-clickjacking
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

const SECURITY_HEADERS = [
  // HTTPS forcé 2 ans, subdomain + preload
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Interdit les iframes externe (clickjacking)
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  // Empêche le MIME sniffing
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Politique referrer stricte
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  // Permissions API — désactivées par défaut
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Content Security Policy
  { key: "Content-Security-Policy",   value: CSP },
  // Supprime l'en-tête "X-Powered-By: Next.js"
  { key: "X-Powered-By",             value: "" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,                 // retire "X-Powered-By: Next.js"

  async headers() {
    return [
      {
        source: "/(.*)",                  // toutes les routes
        headers: SECURITY_HEADERS.filter(h => h.value !== ""),
      },
    ];
  },

  // Forcer HTTPS en production (NextResponse.redirect → https)
  async redirects() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://collab.lotier-immobilier.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
