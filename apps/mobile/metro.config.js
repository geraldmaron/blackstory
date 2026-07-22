/**
 * Metro bundler config for apps/mobile.
 *
 * apps/mobile is intentionally excluded from the root pnpm workspace
 * (`!apps/mobile` in pnpm-workspace.yaml) and uses its own npm lockfile.
 * Shared client-safe contracts live in `packages/public-contracts` (@repo scope).
 * This config watches that package and resolves `@repo/public-contracts/*`
 * subpaths so Metro and the native bundle stay aligned with the wire schemas
 * without pulling the mobile app into the pnpm workspace graph.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const publicContractsRoot = path.resolve(workspaceRoot, 'packages/public-contracts');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), publicContractsRoot];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    '@repo/public-contracts': publicContractsRoot,
  },
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['development', 'require', 'import', 'default'],
};

module.exports = config;
