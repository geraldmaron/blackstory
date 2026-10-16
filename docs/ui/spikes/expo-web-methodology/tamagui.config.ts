import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

// Brand swatches copied from packages/ui/src/tokens/brand-palette.ts
const brand = {
  blackInk: '#0A0A0A',
  charcoal: '#161616',
  archivePaper: '#F4EFE5',
  surface: '#FBF8F2',
  copperPin: '#B86B2A',
  pageSand: '#D8A178',
  stone: '#6D675F',
  rule: '#D7D0C4',
  copperTextLight: '#8E4F2A',
  copperDark: '#D07A32',
};
export const config = createTamagui({
  ...defaultConfig,
  tokens: { ...defaultConfig.tokens, color: { ...defaultConfig.tokens.color, ...brand } },
});
export default config;
export type AppConfig = typeof config;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
