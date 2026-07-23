/**
 * Local expand/collapse control for dense entity sections (e.g. accepted claims). Keeps the
 * first `previewCount` items visible and hides the rest behind an accessible toggle so long
 * lists do not dominate the scroll spine by default.
 *
 * Lives under `features/entity/sections` (not `@/ui`) so the shared UI barrel stays unchanged
 * for parallel Explore agents. Uses an explicit `items` array (not JSX `children`) so slicing
 * the preview is reliable under React's children flattening.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, space } from '@/ui';

export type ExpandableSectionProps = {
  readonly previewCount: number;
  readonly items: readonly ReactNode[];
  /** Accessible name stem, e.g. "claims" → "Show all N claims" / "Show fewer claims". */
  readonly itemLabel: string;
};

export function ExpandableSection({ previewCount, items, itemLabel }: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCount = items.length;
  const needsToggle = totalCount > previewCount;
  const visible = needsToggle && !expanded ? items.slice(0, previewCount) : items;
  const hiddenCount = Math.max(0, totalCount - previewCount);

  function handleToggle() {
    setExpanded(!expanded);
  }

  return (
    <View style={{ gap: space['2'] }}>
      {visible}
      {needsToggle ? (
        <Button
          label={expanded ? `Show fewer ${itemLabel}` : `Show all ${totalCount} ${itemLabel}`}
          variant="ghost"
          density="compact"
          accessibilityLabel={
            expanded ? `Show fewer ${itemLabel}` : `Show ${hiddenCount} more ${itemLabel}`
          }
          accessibilityState={{ expanded }}
          onPress={handleToggle}
        />
      ) : null}
    </View>
  );
}
