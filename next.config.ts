import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP (Fase 8). Next.js menyisipkan skrip inline untuk hidrasi, jadi script-src memakai 'unsafe-inline'
// (CSP berbasis nonce butuh middleware dinamis; belum dipakai agar login/Auth.js tidak berisiko putus).
// Tetap membatasi asal skrip/koneksi, framing, base-uri, object, dan tujuan form.
// Bila ada halaman yang rusak karena CSP, set CSP_REPORT_ONLY=1 (hanya melaporkan di console, tidak memblokir).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com", // Chrome menerapkan form-action juga pada redirect ke Google
].join("; ");

const securityHeaders = [
  { key: process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "exceljs", "jspdf", "jspdf-autotable"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
