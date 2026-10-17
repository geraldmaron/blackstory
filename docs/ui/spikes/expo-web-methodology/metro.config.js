const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');
const config = getDefaultConfig(__dirname, { isCSSEnabled: true });
module.exports = withTamagui(config, {
  components: ['@tamagui/stacks', '@tamagui/text'],
  config: './tamagui.config.ts',
  logTimings: true,
  disableExtraction: true,
});
