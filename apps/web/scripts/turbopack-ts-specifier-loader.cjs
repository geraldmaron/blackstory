/**
 * Turbopack loader: rewrite NodeNext-style relative specifiers (`./x.js`) to extensionless ones
 * so they resolve to the `.ts`/`.tsx` source behind them.
 *
 * Why this exists: the workspace packages are authored for NodeNext (`import './x.js'` where the
 * file is `x.ts`) because their `dist` builds run under plain Node. Webpack maps `.js` to `.ts`
 * with `resolve.extensionAlias`; Turbopack has no equivalent (vercel/next.js#82945). Rewriting the
 * source in the package files themselves would break those Node builds, so the rewrite happens
 * here, in memory, only while Next compiles. Only relative specifiers are touched; package
 * specifiers (`zod`, `@repo/x/y.js`) are left alone.
 */
const RELATIVE_JS_SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"'\n]+?)\.js\2/g;

module.exports = function turbopackTsSpecifierLoader(source) {
  return typeof source === 'string' ? source.replace(RELATIVE_JS_SPECIFIER, '$1$2$3$2') : source;
};
