/**
 * Next.js config for the public web surface.
 * Static entity routes prefer CDN caching; middleware strips unknown query params.
 * Next 16 defaults to Turbopack; this app keeps Webpack for NodeNext `.js`→`.ts`
 * remapping under transpilePackages until Turbopack supports extensionAlias.
 */

import { securityHeadersForNextConfig } from './src/lib/web-security/next-config-headers.mjs';

const globalSecurityHeaders = securityHeadersForNextConfig();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow local verification via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // App Hosting CI run typecheck as a separate gate; keep `next build` focused on
  // emit so monorepo package-dist skew cannot block image publish.
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    '@repo/domain',
    '@repo/schemas',
    '@repo/ui',
    '@repo/security',
    '@repo/firebase',
  ],
  webpack: (config) => {
    // NodeNext packages emit `.js` specifiers that map to `.ts`/`.tsx` sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  experimental: {
    // Prefer cached static segments; avoid eager dynamic revalidation on public pages.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async rewrites() {
    // Machine JSON stays at the public `/facts/{id}.json` URL; the handler lives under
    // `/facts/json/{id}` so it does not collide with the slug HTML page at `/facts/[id]`.
    return [
      {
        source: '/facts/:id.json',
        destination: '/facts/json/:id',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: globalSecurityHeaders,
      },
      {
        source: '/entity/:id',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/search',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/history',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
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
    ];
  },
};

export default nextConfig;
