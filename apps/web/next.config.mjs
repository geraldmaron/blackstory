/**
 * Next.js config for the public web surface.
 * Static entity routes prefer CDN caching; middleware strips unknown query params.
 * Next 16 defaults to Turbopack; this app keeps Webpack for NodeNext `.js`→`.ts`
 * remapping under transpilePackages until Turbopack supports extensionAlias.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeadersForNextConfig } from './src/lib/web-security/next-config-headers.mjs';

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
    '/*': ['./packages/schemas/constitution/**/*'],
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
    return [
      {
        source: '/topics',
        destination: '/stories',
        permanent: true,
      },
      {
        source: '/topics/:path*',
        destination: '/stories',
        permanent: true,
      },
      {
        source: '/facts',
        destination: '/history',
        permanent: true,
      },
      {
        source: '/facts/:path*',
        destination: '/history',
        permanent: true,
      },
      {
        source: '/search',
        destination: '/history',
        permanent: true,
      },
      {
        source: '/myths',
        destination: '/methodology',
        permanent: true,
      },
      {
        source: '/myths/:path*',
        destination: '/methodology',
        permanent: true,
      },
      {
        source: '/legal',
        destination: '/law',
        permanent: true,
      },
      {
        source: '/legal/:path*',
        destination: '/law/:path*',
        permanent: true,
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
    ];
  },
};

export default nextConfig;
