/**
 * Compact story index row — ledger density for Stories home and section indexes.
 */
import { LedgerRow, NavIcon } from '@/ui';
import type { LearnContentEntry } from './content-catalog';

export interface StoryCompactRowProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
  readonly showDivider?: boolean;
}

export function StoryCompactRow({ entry, onPress, showDivider = true }: StoryCompactRowProps) {
  const { page } = entry;
  const slug = [page.eraLabel, page.placeLabel].filter(Boolean).join(' · ');

  return (
    <LedgerRow
      title={page.title}
      slug={slug || undefined}
      summary={page.dek}
      leading={<NavIcon name="story" size={20} />}
      showChevron
      showDivider={showDivider}
      onPress={onPress}
      accessibilityLabel={`${page.title}${slug ? `, ${slug}` : ''}`}
    />
  );
}
