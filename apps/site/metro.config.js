const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');

const repoRoot = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

// Single sources that still live outside this package: brand tokens, and the methodology copy
// that apps/web owns until the Next app is removed (then it moves here).
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.join(repoRoot, 'brand/tokens'),
  path.join(repoRoot, 'apps/web/src'),
  path.join(repoRoot, 'apps/web/node_modules'),
  path.join(repoRoot, 'packages'),
  // pnpm's virtual store: the real location of every package apps/web and packages/* depend on.
  path.join(repoRoot, 'node_modules/.pnpm'),
];

// The server data layer (src/server/data) reuses Next-independent modules that still live in
// apps/web/src. Their imports (@repo/*, pg, zod) resolve through apps/web's node_modules, so Metro
// is allowed to look there. When apps/web is removed those files move here and this block goes.
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    ...(config.resolver?.nodeModulesPaths ?? []),
    path.join(repoRoot, 'apps/web/node_modules'),
  ],
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    '@repo/domain': path.join(repoRoot, 'packages/domain'),
    '@repo/schemas': path.join(repoRoot, 'packages/schemas'),
  },
  unstable_enablePackageExports: true,
  // dist/ (import/require/default), not src/ ('development'): src uses `.js` specifiers Metro cannot map.
  unstable_conditionNames: ['require', 'import', 'default'],
};

module.exports = withTamagui(config, {
  components: ['@tamagui/stacks', '@tamagui/text'],
  config: './tamagui.config.ts',
  disableExtraction: true,
});
