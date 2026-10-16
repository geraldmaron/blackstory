import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from '@tamagui/core';
// Single brand source, also read by mobile token generation (brand/tokens/colors.json).
import brand from '../../brand/tokens/colors.json';

/**
 * Two themes and the brand swatches only. The stock v5 config emits every theme and color ramp:
 * 457 KB of inline CSS on a bare page, against 52 KB with this trim (plan doc, section 10).
 * Components use the semantic roles below, never a brand hex, so light and dark stay one code path.
 */
const dark = {
  background: brand.blackInk,
  backgroundRaised: brand.charcoal,
  color: brand.archivePaper,
  colorMuted: brand.pageSand,
  borderColor: brand.stone,
  accent: brand.copperTextDark,
  accentFill: brand.copperPin,
};
const light = {
  background: brand.archivePaper,
  backgroundRaised: brand.surface,
  color: brand.blackInk,
  colorMuted: brand.stone,
  borderColor: brand.rule,
  accent: brand.copperTextLight,
  accentFill: brand.copperPin,
};

export const config = createTamagui({
  ...defaultConfig,
  themes: { light, dark },
  tokens: { ...defaultConfig.tokens, color: brand },
});

export default config;
export type AppConfig = typeof config;
// Slim `@tamagui/*` packages type against @tamagui/web; `tamagui` and `@tamagui/core` re-export it.
// Augment each entry point so every import style sees the app's theme and token types.
declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends AppConfig {}
}
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
