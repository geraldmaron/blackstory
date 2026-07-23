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
import { LayoutAnimation, Platform, UIManager, View } from 'react-native';
import { Button, duration, space } from '@/ui';
import { useReduceMotion } from '@/features/explore/useReduceMotion';

// Android opts out of LayoutAnimation by default; enable it once at module load. iOS ignores this.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A gentle ease-out grow/shrink so inserting several claim cards does not snap the scroll spine.
const EXPAND_LAYOUT_ANIMATION = {
  duration: duration.durationBase,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export type ExpandableSectionProps = {
  readonly previewCount: number;
  readonly items: readonly ReactNode[];
  /** Accessible name stem, e.g. "claims" → "Show all N claims" / "Show fewer claims". */
  readonly itemLabel: string;
};

export function ExpandableSection({ previewCount, items, itemLabel }: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReduceMotion();
  const totalCount = items.length;
  const needsToggle = totalCount > previewCount;
  const visible = needsToggle && !expanded ? items.slice(0, previewCount) : items;
  const hiddenCount = Math.max(0, totalCount - previewCount);

  function handleToggle() {
    // Animate the height change so the inserted/removed cards ease in instead of snapping the
    // scroll position — unless the user has asked for reduced motion.
    if (!reduceMotion) {
      LayoutAnimation.configureNext(EXPAND_LAYOUT_ANIMATION);
    }
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
