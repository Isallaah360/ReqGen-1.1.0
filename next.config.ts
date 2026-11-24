import type { NextConfig } from "next";

/**
 * ReqGen v4.7.0 (Barderian Privacy and Lightness Check): the website may talk only to our own
 * servers: this website (Vercel) and our database (Supabase). No fonts, scripts, trackers or
 * analytics from anywhere else. SMS and e-mail go out from our server only (Sendchamp), never
 * from the browser.
 */
const supabase = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host; } catch { return ""; }
})();
const db = supabase ? `https://${supabase} wss://${supabase}` : "https://*.supabase.co wss://*.supabase.co";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase ? `https://${supabase}` : "https://*.supabase.co"}`,
  "font-src 'self' data:",
  `connect-src 'self' ${db}`,
  "media-src 'self' blob:",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
      {
        // v4.7.1: the real app sends the same SMS and e-mail notices as the website.
        source: "/api/notifications/sms/:event(request-event|request-approval)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://localhost" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Vary", value: "Origin" },
        ],
      },
      {
        // The real app (inside the APK) reads the newest version number.
        source: "/downloads/app-version.json",
        headers: [{ key: "Access-Control-Allow-Origin", value: "https://localhost" }, { key: "Vary", value: "Origin" }],
      },
    ];
  },
};

export default nextConfig;
