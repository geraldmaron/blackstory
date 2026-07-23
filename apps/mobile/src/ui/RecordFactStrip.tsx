/**
 * Compact 2-column fact grid for record rows and cards (mobile v6 edition anatomy).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { EditionFactCell, type EditionFactCellProps } from './EditionFactCell';
import { type TextRole } from './Text';
import { space } from './tokens';

export type RecordFactStripItem = Omit<EditionFactCellProps, 'valueNode'> & {
  readonly key: string;
  readonly valueNode?: ReactNode;
};

export type RecordFactStripProps = {
  readonly facts: readonly RecordFactStripItem[];
  readonly valueVariant?: TextRole;
};

export function RecordFactStrip({ facts, valueVariant }: RecordFactStripProps) {
  if (facts.length === 0) return null;

  return (
    <View style={styles.strip} accessibilityRole="none">
      {facts.map((fact) => (
        <EditionFactCell
          key={fact.key}
          label={fact.label}
          value={fact.value}
          leading={fact.leading}
          valueNode={fact.valueNode}
          valueVariant={fact.valueVariant ?? valueVariant}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space['3'],
    rowGap: space['2'],
  },
});
