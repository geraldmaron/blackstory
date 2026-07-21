/**
 * Next.js config for the operator admin console.
 * Keeps Webpack for NodeNext `.js`→`.ts` remapping under transpilePackages.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App Hosting / Cloud Run need a self-contained server bundle for monorepo deploys.
  output: 'standalone',
  transpilePackages: [
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
