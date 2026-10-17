import type { TamaguiBuildOptions } from 'tamagui';

/**
 * Extraction is OFF on purpose. With `@tamagui/babel-plugin` on Expo SDK 57 and Tamagui 2.7.7 the
 * compiler ran but produced an empty server body (docs/ui/expo-tamagui-migration-plan.md, section 10).
 * Size is controlled by the trimmed config and slim `@tamagui/*` imports instead.
 */
export default {
  components: ['@tamagui/stacks', '@tamagui/text'],
  config: './tamagui.config.ts',
  disableExtraction: true,
} satisfies TamaguiBuildOptions;
