/**
 * Ledger masthead with compact official BlackStory lockup above the type.
 * Uses approved lockup artwork (light/dark) — never a typed wordmark + symbol.
 */
import { StyleSheet, View } from 'react-native';
import { Logo } from './Logo';
import { ScreenHeader, type ScreenHeaderProps } from './ScreenHeader';
import { space } from './tokens';

/** Compact lockup width (guide digital minimum). Height follows authored aspect. */
const BRAND_LOCKUP_WIDTH = 120;

export type EditionBrandHeaderProps = ScreenHeaderProps & {
  /** When false, render Ledger masthead only. Default true. */
  readonly showBrand?: boolean;
};

export function EditionBrandHeader({
  showBrand = true,
  ...headerProps
}: EditionBrandHeaderProps) {
  return (
    <View style={styles.block} testID="edition-brand-header">
      {showBrand ? (
        <View style={styles.brand} testID="edition-brand-lockup">
          <Logo variant="lockup" size={BRAND_LOCKUP_WIDTH} />
        </View>
      ) : null}
      <ScreenHeader {...headerProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['3'],
  },
  brand: {
    alignSelf: 'flex-start',
  },
});
