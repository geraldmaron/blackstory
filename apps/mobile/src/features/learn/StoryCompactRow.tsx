/**
 * Compact story index row — v6 ledger density with label-over-value era/place facts.
 */
import { View } from 'react-native';
import { LedgerRow, NavIcon, RecordFactStrip, space } from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import type { LearnContentEntry } from './content-catalog';

export interface StoryCompactRowProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
  readonly showDivider?: boolean;
  readonly indexLabel?: string;
}

export function StoryCompactRow({ entry, onPress, showDivider = true, indexLabel }: StoryCompactRowProps) {
  const { page } = entry;
  const facts = [
    ...(page.eraLabel
      ? [{ key: 'era', label: 'Era', value: plainRangeText(page.eraLabel) }]
      : []),
    ...(page.placeLabel ? [{ key: 'where', label: 'Where', value: page.placeLabel }] : []),
  ];

  return (
    <LedgerRow
      title={page.title}
      summary={page.dek}
      indexLabel={indexLabel}
      leading={<NavIcon name="story" size={20} />}
      showChevron
      showDivider={showDivider}
      onPress={onPress}
      accessibilityLabel={`${page.title}${page.eraLabel ? `, ${plainRangeText(page.eraLabel)}` : ''}`}
      secondaryAction={
        facts.length > 0 ? (
          <View style={{ marginTop: space['1'] }}>
            <RecordFactStrip facts={facts} />
          </View>
        ) : undefined
      }
    />
  );
}
