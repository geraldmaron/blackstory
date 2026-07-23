/**
 * Shared list screen for legal/errata-style sections: v6 Surface edition stack with
 * indexed intro and compact LedgerRow index inside a raised panel.
 */
import { ScrollView, StyleSheet } from 'react-native';
import {
  EditionSurfacePanel,
  EditionSurfaceStack,
  LedgerRow,
  ScreenCanvas,
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
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        <EditionSurfaceStack>
          <EditionSurfacePanel index="00" kicker={kicker} title={title} dek={intro} compact />

          <EditionSurfacePanel index="01" kicker="Index" title="Pages" panelMeta={countLabel}>
            {rows.map((row, index) => (
              <LedgerRow
                key={row.key}
                title={row.title}
                summary={row.subtitle}
                indexLabel={String(index + 1).padStart(2, '0')}
                onPress={row.onPress}
                showChevron
                showDivider={index < rows.length - 1}
              />
            ))}
          </EditionSurfacePanel>
        </EditionSurfaceStack>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
  },
});
