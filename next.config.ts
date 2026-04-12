import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Vercel nastavuje tyto proměnné při každém buildu automaticky.
    // Přes `env` block se "upečou" do JS bundle — čitelné i na klientovi.
    // Lokálně fallbackují na "dev" / "local" / "development".
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
  },
};

export default nextConfig;
