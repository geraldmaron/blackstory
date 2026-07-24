/**
 * Shared list screen for legal/errata-style sections (Ledger Line): canvas masthead
 * + mono section label + compact LedgerRow index — no indexed Surface panels.
 * Stack-pushed (not tab-root), so scroll bottom pad uses static screenScrollInsets
 * and the native stack header owns the top inset.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  LedgerRow,
  LedgerSectionLabel,
  ScreenCanvas,
  ScreenHeader,
  screenScrollInsets,
} from '@/ui';

export interface SectionListRow {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
}

export interface SectionListScreenProps {
  readonly title: string;
  readonly intro?: string;
  readonly kicker?: string;
  readonly rows: readonly SectionListRow[];
}

export function SectionListScreen({ title, intro, kicker = 'Archive', rows }: SectionListScreenProps) {
  const countLabel = rows.length === 1 ? '1 page' : `${rows.length} pages`;

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker={kicker} title={title} dek={intro} compact dense />
        <View>
          <LedgerSectionLabel meta={countLabel}>Pages</LedgerSectionLabel>
          {rows.map((row, index) => (
            <LedgerRow
              key={row.key}
              title={row.title}
              summary={row.subtitle}
              onPress={row.onPress}
              showChevron
              showDivider={index < rows.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: screenScrollInsets.gap,
  },
});
