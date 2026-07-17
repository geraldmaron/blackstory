/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@black-book/domain', '@black-book/schemas', '@black-book/ui'],
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
