/**
 * Prefix absolute site paths with DOCS_BASE_PATH for GitHub Pages static export.
 * Next.js basePath covers Link/router; public assets and some metadata need this.
 */
const BASE = process.env.DOCS_BASE_PATH || '';

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) {
    return path;
  }
  if (!BASE) {
    return path;
  }
  if (path === '/') {
    return `${BASE}/`;
  }
  return `${BASE}${path}`;
}
