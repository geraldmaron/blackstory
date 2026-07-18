/**
 * Next.js config for the operator admin console.
 * Keeps Webpack for NodeNext `.js`→`.ts` remapping under transpilePackages.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@repo/domain',
    '@repo/schemas',
    '@repo/ui',
    '@repo/operator-cli',
    '@repo/security',
    '@repo/firebase',
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
