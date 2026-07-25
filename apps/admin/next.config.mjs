/**
 * Next.js config for the operator admin console.
 * Keeps Webpack for NodeNext `.js`→`.ts` remapping under transpilePackages.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel serves the Next build directly (same as apps/web) — do not emit
  // `output: 'standalone'`. Admin is its own Vercel project so its
  // write-capable DATABASE_URL stays out of the public site's runtime env.
  // @repo/domain reads dist/graph/data/mention-overrides.json at runtime via
  // fs (a computed path the tracer can't follow) — include it explicitly so
  // the serverless bundle carries it.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    '/*': ['../../packages/domain/dist/graph/data/**/*'],
  },
  transpilePackages: [
    '@repo/config',
    '@repo/domain',
    '@repo/data-access',
    '@repo/schemas',
    '@repo/ui',
    '@repo/operator-cli',
    '@repo/security',
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
