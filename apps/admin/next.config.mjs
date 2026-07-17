/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@black-book/domain', '@black-book/schemas'],
};

export default nextConfig;
