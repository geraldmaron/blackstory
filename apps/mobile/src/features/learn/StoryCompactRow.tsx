/**
 * Compact story index row — v6 ledger density with a one-line mono era · place slug.
 */
import { LedgerRow, NavIcon } from '@/ui';
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
  const era = page.eraLabel ? plainRangeText(page.eraLabel) : '';
  const place = page.placeLabel ?? '';
  const slug = [era, place].filter(Boolean).join(' · ');

  return (
    <LedgerRow
      title={page.title}
      slug={slug || undefined}
      indexLabel={indexLabel}
      leading={<NavIcon name="story" size={20} />}
      showChevron
      showDivider={showDivider}
      onPress={onPress}
      accessibilityLabel={`${page.title}${era ? `, ${era}` : ''}`}
    />
  );
}
