/**  {import('next').NextConfig} */
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
    // NodeNext packages emit `.js` specifiers that map to `.ts`/`.tsx` sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
