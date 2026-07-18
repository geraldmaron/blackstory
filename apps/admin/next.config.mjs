/**
 * Next.js config for the operator admin console.
 * Keeps Webpack for NodeNext `.js`→`.ts` remapping under transpilePackages.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@blap/domain',
    '@blap/schemas',
    '@blap/ui',
    '@blap/operator-cli',
    '@blap/security',
    '@blap/firebase',
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
