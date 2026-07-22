/**
 * Official BlackStory brand mark, rendered from the approved raster exports
 * in assets/brand/ (copied verbatim from brand/logos and brand/symbols —
 * never re-vectorized or redrawn). Enforces the guide's usage rules
 * (brand/guide/pages/03-usage-rules.png, transcribed into
 * tokens/generated/logo.generated.ts):
 *
 *  - `resizeMode="contain"` at the source aspect ratio always — never
 *    stretched/squashed.
 *  - No rotation, no recoloring, no shadow/effect props are exposed.
 *  - `size` cannot be set below the guide's minimum (lockup: 120px digital;
 *    symbol: 96px) — requests below the floor are clamped up, not rejected
 *    silently, so a caller notices during development.
 *  - `variant="lockup"` picks light/dark lockup by theme; `variant="symbol"`
 *    picks the symbol-only mark (approved for tight spaces / icon-like use
 *    per the guide).
 */
import { Image } from 'expo-image';
import { View } from 'react-native';
import { logoConstraints, useThemeName } from './tokens';

const LOCKUP_ASPECT_RATIO = 1672 / 941;

const SOURCES = {
  lockup: {
    light: require('../../assets/brand/logos/light/BlackStory-primary-lockup-light-transparent.png'),
    dark: require('../../assets/brand/logos/dark/BlackStory-primary-lockup-dark-transparent.png'),
  },
  symbol: {
    light: require('../../assets/brand/symbols/light/BlackStory-symbol-light-transparent-1024.png'),
    dark: require('../../assets/brand/symbols/dark/BlackStory-symbol-dark-transparent-1024.png'),
  },
} as const;

export type LogoProps = {
  variant?: 'lockup' | 'symbol';
  /** Width in dp for 'lockup' (height derives from the fixed aspect ratio), or side length for 'symbol'. */
  size?: number;
  /**
   * Forces a specific rendered variant instead of following the system color
   * scheme — use only when the surrounding background is fixed regardless of
   * theme (e.g. an always-dark hero band).
   */
  forceScheme?: 'light' | 'dark';
};

/**
 * Guide rule: clear space on every side must equal the rendered symbol's
 * height. `renderedSymbolHeight` is the symbol's on-screen height in dp
 * (for a lockup, this is the lockup's own rendered height, since the symbol
 * occupies the full height of the lockup). Callers apply the returned value
 * as margin/padding around the Logo.
 */
export function logoClearSpaceDp(renderedSymbolHeight: number): number {
  return logoConstraints.clearSpaceEqualsSymbolHeight ? renderedSymbolHeight : 0;
}

export function Logo({ variant = 'lockup', size, forceScheme }: LogoProps) {
  const themeName = useThemeName();
  const scheme = forceScheme ?? themeName;
  const source = SOURCES[variant][scheme];

  const minWidth =
    variant === 'lockup' ? logoConstraints.minLockupWidthPx : logoConstraints.minSymbolSizePx;
  const width = Math.max(size ?? minWidth, minWidth);
  const height = variant === 'lockup' ? width / LOCKUP_ASPECT_RATIO : width;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="BlackStory"
      style={{ width, height }}
    >
      <Image
        source={source}
        contentFit="contain"
        style={{ width, height }}
        accessible={false}
      />
    </View>
  );
}
