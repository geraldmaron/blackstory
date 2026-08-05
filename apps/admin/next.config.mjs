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
  // Mention overrides: this include may no longer be needed. The comment here used to say
  // @repo/domain reads the JSON at runtime via fs on a path the tracer cannot follow, and that
  // is no longer true — packages/domain/src/graph/mention-resolver.ts imports it statically
  // (`import ... with { type: 'json' }`), so the bundler carries it without help. Left in place
  // rather than removed on that inference alone; removal is being evaluated under repo-01si,
  // which covers this config as well as apps/web's.
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
