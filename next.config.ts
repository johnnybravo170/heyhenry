import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://*.supabase.co/storage/**')],
  },
  // Baseline HTTP security headers on every route. Scope is deliberately
  // transport/framing/sniffing only — NOT a content CSP. The app loads
  // Supabase, Stripe, Sentry, Google Maps and Vercel scripts, so a strict
  // script-src/connect-src/style-src policy would risk breaking it and needs
  // its own careful rollout. `frame-ancestors 'none'` (plus the legacy
  // X-Frame-Options fallback) is the clickjacking control that protects the
  // public money-approval pages (/approve/[code], /estimate/[code]) from
  // being overlaid in a hostile frame.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // The Property Record was formerly the "Home Record". Its public share
  // links are a permanent contract — every record already emailed to a
  // customer points at /home-record/<slug> (and /download, /download-zip).
  // Permanently redirect the whole old subtree so no shared link ever 404s.
  async redirects() {
    return [
      {
        source: '/home-record/:path*',
        destination: '/property-record/:path*',
        permanent: true,
      },
    ];
  },
  // The single `src/pages/api/henry/gemini-proxy.ts` route triggers Next's
  // pages-compat type augmentation in next-env.d.ts, which flips
  // useSearchParams/useParams/usePathname return types to nullable across
  // all app-router code. The project's `pnpm typecheck` step runs without
  // that augmentation and is the authoritative type gate; skip the
  // duplicate check inside `next build` so deploys don't spuriously fail.
  //
  // ⚠ Linked to src/pages/api/henry/gemini-proxy.ts — that route can't move
  // to App Router (route handlers don't support WebSocket upgrade per Next 16
  // docs: 01-app/02-guides/backend-for-frontend.md). If that file ever leaves
  // src/pages/, delete this `typescript.ignoreBuildErrors` block too — they
  // exist as a pair.
  typescript: {
    ignoreBuildErrors: true,
  },
  // `read-excel-file/node` (used by `src/server/actions/coa-mapping.ts`)
  // depends on `unzipper`, which has a dynamic `require('@aws-sdk/client-s3')`
  // in an S3-source code path we never hit (we feed it a Buffer). Turbopack
  // / webpack try to statically resolve the require and fail the build with
  // "Module not found: @aws-sdk/client-s3". Marking these as external keeps
  // them out of the bundle and resolved at runtime from node_modules, where
  // the unused branch stays inert.
  serverExternalPackages: ['read-excel-file', 'unzipper'],
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'smart-fusion-marketing-inc-6r',

  project: 'heyhenry',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
