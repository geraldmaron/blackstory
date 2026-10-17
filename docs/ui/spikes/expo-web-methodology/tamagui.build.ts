import type { TamaguiBuildOptions } from 'tamagui';
export default {
  components: ['@tamagui/stacks', '@tamagui/text'],
  config: './tamagui.config.ts',
  logTimings: true,
  disableExtraction: true,
} satisfies TamaguiBuildOptions;
