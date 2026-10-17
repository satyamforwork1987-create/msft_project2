import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained build under .next/standalone — required for the
  // Docker image so it doesn't need the full node_modules tree at runtime.
  output: 'standalone',
  experimental: {
    // No special flags needed
  },
  // Allow environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
