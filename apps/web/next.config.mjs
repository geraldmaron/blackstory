/**
 * Next.js config for the public web surface.
 * Static entity routes prefer CDN caching; middleware strips unknown query params.
 * Next 16 defaults to Turbopack; this app keeps Webpack for NodeNext `.js`→`.ts`
 * remapping under transpilePackages until Turbopack supports extensionAlias.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeadersForNextConfig } from './src/lib/web-security/next-config-headers.mjs';
import { redirectsForNextConfig } from './src/lib/redirects/next-config-redirects.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, '../..');

const globalSecurityHeaders = securityHeadersForNextConfig();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow local verification via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Keep `next build` focused on emit; typecheck stays a separate CI gate.
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    '@repo/config',
    '@repo/domain',
    '@repo/schemas',
    '@repo/ui',
    '@repo/security',
    '@repo/observability',
  ],
  // Vercel serves the Next build directly — do not emit `output: 'standalone'`.
  // Constitution JSON is read at runtime via fs (not import); include it in serverless traces.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    // Globs resolve relative to the app dir (apps/web), so monorepo files need ../../.
    '/*': [
      './packages/schemas/constitution/**/*',
      '../../packages/schemas/constitution/**/*',
      // Mention overrides: these two globs may no longer be needed. The comment here used to say
      // @repo/domain reads the JSON at runtime via fs, and that is no longer true —
      // packages/domain/src/graph/mention-resolver.ts imports it statically
      // (`import ... with { type: 'json' }`), so the bundler carries it without help.
      // Left in place deliberately rather than removed on that reasoning alone: if the inference
      // is wrong, every dynamic route 500s with ENOENT in production. Removal is being evaluated
      // under repo-01si, which wants a real production build to confirm before deleting.
      '../../packages/domain/dist/graph/data/**/*',
      '../../packages/domain/src/graph/data/**/*',
    ],
  },
  webpack: (config, { isServer }) => {
    // NodeNext packages emit `.js` specifiers that map to `.ts`/`.tsx` sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    // Belt-and-suspenders: if a client graph still touches a Node builtin via a
    // mis-imported barrel, fail closed with an empty shim instead of UnhandledSchemeError.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        crypto: false,
        dns: false,
        fs: false,
        http: false,
        https: false,
        net: false,
        path: false,
        tls: false,
        url: false,
      };
    }
    return config;
  },
  experimental: {
    // Prefer cached static segments; avoid eager dynamic revalidation on public pages.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async redirects() {
    return redirectsForNextConfig();
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: globalSecurityHeaders,
      },
      {
        // A receipt code is a private handle to one person's correction. The page is
        // unguessable rather than access-controlled, so the risk is not someone browsing to it
        // but a crawler that saw the URL in a referrer or a pasted link putting it in an index.
        //
        // `noindex` de-lists it; `follow` is kept because the page links back to /corrections.
        // Deliberately NOT paired with a robots.txt Disallow (SP-19, repo-92n2.19): a Disallowed
        // URL is never fetched, so this header would never be read, and the URL could still be
        // indexed from an inbound link with nothing but its own text. Blocking the fetch and
        // asking for removal are opposite instructions, and only one of them works here.
        //
        // Sent as a header rather than a `<meta>` tag, which covers the non-HTML responses the
        // path can return as well as the page itself.
        source: '/corrections/status/:receiptCode*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      },
      // Cache-Control here only reaches the CDN for routes that are NOT dynamically rendered.
      //
      // Measured on Vercel, 2026-08-09: a dynamically rendered route sends Next's own
      // `private, no-cache, no-store, max-age=0, must-revalidate`, and that wins over anything
      // declared here. `main` has carried the `/` rule below for weeks and production still
      // answered `/` with no-store and `x-vercel-cache: MISS` on every request. Note this does
      // NOT reproduce under `next start`, where the rule below does take effect: the precedence
      // differs between the local server and Vercel's routing layer, so a local check will tell
      // you these rules work when on Vercel they do not.
      //
      // Practical rule: making a route cacheable is a route-segment-config change (ISR), not a
      // header change. The header is what the CDN then honours.
      {
        // Live: /entity/[id] became ISR (revalidate=3600), so this is now the served header.
        source: '/entity/:id',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // INERT while `/` is force-dynamic, which it must stay: the Atlas reads searchParams for
        // its state/era/kind/topic filters, and App Router renders any searchParams-reading page
        // per request. Kept, not deleted, because it is the intended posture the moment `/` can
        // stop being dynamic (see repo-ajb0 for the partial-prerender option).
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/history',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/explore',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/methodology',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/submit',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
