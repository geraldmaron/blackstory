/**
 * The app's Tamagui config is the design system's: see src/design/config.ts. This file exists because the
 * Tamagui compiler, Metro plugin and the module augmentation below all expect a root `tamagui.config.ts`.
 */
import { config } from './src/design/config';

export { config };
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
