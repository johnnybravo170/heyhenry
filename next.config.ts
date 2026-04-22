import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://*.supabase.co/storage/**')],
  },
  experimental: {
    serverActions: {
      // Photo uploads travel through server actions as multipart FormData.
      // Next.js defaults to 1MB. Project intake batches multiple phone
      // jpgs + PDFs in a single action, so we lift to 50mb to match
      // Supabase Storage's 50MiB cap. Per-file 10MB enforcement still
      // happens inside each action.
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
