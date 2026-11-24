/**
 * One figure on the Data screen (docs/ui/DESIGN.md section 9.5, phone): its title, a view switch
 * with Plain as the default and Numbers one tap away, the drawing in a figure exhibit, its
 * sources as the receipt, and its limits in full under it. The app draws no Portrait: none of
 * its figures has a Du Bois form that labels its values legibly at phone width.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExhibitFrame, Receipt, Segmented, Text, space, useThemeColors } from '@/ui';
import type { DataSourceRef } from './types';

type FigureView = 'plain' | 'numbers';

const VIEWS = [
  { id: 'plain', label: 'Plain' },
  { id: 'numbers', label: 'Numbers' },
] as const;

export type DataFigureProps = {
  readonly title: string;
  /** The figure's real scope: its geography and period. Never implied to be anything narrower. */
  readonly scope: string;
  /** What the figure can and cannot tell you. Always visible. */
  readonly limits: string;
  readonly sources: readonly DataSourceRef[];
  readonly plain: ReactNode;
  readonly numbers: readonly NumbersRow[];
  readonly testID?: string;
};

export type NumbersRow = { readonly key: string; readonly label: string; readonly value: string };

/** The Numbers view: the figure's values as rows, each read as "label: value". */
function NumbersTable({ rows }: { readonly rows: readonly NumbersRow[] }) {
  const theme = useThemeColors();
  return (
    <View testID="data-figure-numbers">
      {rows.map((row, index) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}`}
          style={[
            styles.numbersRow,
            index > 0
              ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }
              : undefined,
          ]}
        >
          <Text variant="bodySmall" style={styles.numbersLabel}>
            {row.label}
          </Text>
          <Text variant="meta">{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function DataFigure({
  title,
  scope,
  limits,
  sources,
  plain,
  numbers,
  testID,
}: DataFigureProps) {
  const [view, setView] = useState<FigureView>('plain');

  return (
    <View style={styles.figure} testID={testID}>
      <Text variant="title" isHeading>
        {title}
      </Text>
      <Segmented
        options={VIEWS}
        value={view}
        onChange={setView}
        accessibilityLabel={`View of ${title}`}
        testID="data-figure-view"
      />
      <ExhibitFrame
        kind="figure"
        basis={scope}
        receipt={
          <View>
            {sources.map((source) => (
              <Receipt key={source.url} source={source.label} href={source.url} />
            ))}
          </View>
        }
      >
        <View style={styles.object}>
          {view === 'plain' ? plain : <NumbersTable rows={numbers} />}
        </View>
      </ExhibitFrame>
      <Text variant="caption" colorRole="inkMuted">
        {limits}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    gap: space['3'],
  },
  object: {
    padding: space['2'],
  },
  numbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space['2'],
    paddingVertical: space['2'],
  },
  numbersLabel: {
    flexShrink: 1,
  },
});
