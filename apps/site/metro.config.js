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
  path.join(repoRoot, 'apps/web/src/app/methodology'),
];

module.exports = withTamagui(config, {
  components: ['@tamagui/stacks', '@tamagui/text'],
  config: './tamagui.config.ts',
  disableExtraction: true,
});
