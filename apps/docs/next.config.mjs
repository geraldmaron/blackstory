/**
 * Next.js config for the BlackStory GitHub Pages docs site.
 * Static export only; basePath comes from DOCS_BASE_PATH (/blackstory in CI).
 */

/** @type {import('next').NextConfig} */
const basePath = process.env.DOCS_BASE_PATH || '';

const config = {
  output: 'export',
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default config;
