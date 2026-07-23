/**
 * Metro bundler config for apps/mobile.
 *
 * apps/mobile is intentionally excluded from the root pnpm workspace
 * (`!apps/mobile` in pnpm-workspace.yaml) and uses its own npm lockfile.
 * Shared client-safe contracts live in `packages/public-contracts` (@repo scope).
 * Era/decade helpers for record labels come from `packages/domain/src/era.ts`
 * (`@repo/domain/era`) — a leaf module with no domain-package imports.
 * This config watches those packages and resolves their subpath exports so Metro
 * and the native bundle stay aligned without pulling the mobile app into the
 * pnpm workspace graph.
 *
 * Release/EAS bundles must resolve package `import`/`default` exports (dist/),
 * not the `development` condition (src/), because src uses `.js` specifier
 * extensions that Metro cannot map to `.ts` without a custom resolver — and
 * dist is gitignored, so EAS builds it in `eas-build-post-install`.
 */
const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const publicContractsRoot = path.resolve(workspaceRoot, 'packages/public-contracts');
const domainRoot = path.resolve(workspaceRoot, 'packages/domain');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), publicContractsRoot, domainRoot];

const preferSource =
  process.env.NODE_ENV !== 'production' && process.env.EAS_BUILD !== 'true';

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    '@repo/public-contracts': publicContractsRoot,
    '@repo/domain': domainRoot,
  },
  unstable_enablePackageExports: true,
  blockList: [
    /\/__tests__\/.*/,
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
  ],
  // Never put `development` first on EAS/production — that forces src/*.ts and
  // breaks on `.js` import specifiers inside the package.
  unstable_conditionNames: preferSource
    ? ['development', 'require', 'import', 'default']
    : ['require', 'import', 'default'],
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // When resolving from linked package src (local development condition),
  // map ESM `.js` specifiers onto sibling `.ts` files.
  const originInLinkedPackageSrc =
    typeof context.originModulePath === 'string' &&
    (context.originModulePath.startsWith(publicContractsRoot + path.sep) ||
      context.originModulePath.startsWith(domainRoot + path.sep)) &&
    context.originModulePath.includes(`${path.sep}src${path.sep}`);
  if (moduleName.endsWith('.js') && originInLinkedPackageSrc) {
    const dir = path.dirname(context.originModulePath);
    const absJs = path.resolve(dir, moduleName);
    const absTs = absJs.replace(/\.js$/, '.ts');
    if (fs.existsSync(absTs)) {
      return {
        type: 'sourceFile',
        filePath: absTs,
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
