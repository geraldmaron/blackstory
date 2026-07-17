/**
 * Next.js config for the public web surface (BB-022 runtime hardening, BB-028 security).
 * Static entity routes prefer CDN caching; middleware strips unknown query params.
 */

import { securityHeadersForNextConfig } from './src/lib/web-security/next-config-headers.mjs';

const globalSecurityHeaders = securityHeadersForNextConfig();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow local verification via 127.0.0.1 as well as localhost (BB-048 port 3048).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['@black-book/domain', '@black-book/schemas', '@black-book/ui'],
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
    ];
  },
};

export default nextConfig;
