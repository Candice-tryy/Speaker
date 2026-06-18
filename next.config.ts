import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The question bank is read at runtime via fs from process.cwd()/Resource.
  // Next.js output tracing won't follow that dynamic path, so include it
  // explicitly or the deployed server falls back to the tiny built-in bank.
  outputFileTracingIncludes: {
    "/practice": ["./Resource/**/*.json"],
    "/map": ["./Resource/**/*.json"],
    "/profile": ["./Resource/**/*.json"],
  },
};

export default nextConfig;
