/**
 * Compact story index row — v6 ledger density with a one-line mono era · place slug.
 */
import { LedgerRow, NavIcon } from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import type { StoryListItemV1 } from '@repo/public-contracts/v1/story';

export interface StoryCompactRowProps {
  readonly story: StoryListItemV1;
  readonly onPress: () => void;
  readonly showDivider?: boolean;
  readonly indexLabel?: string;
}

export function StoryCompactRow({
  story: page,
  onPress,
  showDivider = true,
  indexLabel,
}: StoryCompactRowProps) {
  const era = page.eraLabel ? plainRangeText(page.eraLabel) : '';
  const place = page.collection?.positionLabel ?? page.placeLabel;
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
