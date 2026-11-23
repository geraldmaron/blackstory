/**
 * The story's progress line with the chapter name (docs/ui/DESIGN.md section 9.3, phone: "the
 * rail becomes a line"). It sits under the header and above the scrolling column. The screen
 * pushes positions in through a ref, so a scroll frame redraws this line and not the story.
 * Nothing animates: the fill is simply as wide as the reader is far.
 */
import { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, space, useThemeColors } from '@/ui';
import type { StoryPosition } from './story-progress';

export type StoryProgressHandle = { readonly set: (position: StoryPosition) => void };

export const StoryProgress = forwardRef<StoryProgressHandle, { readonly title: string }>(
  function StoryProgress({ title }, ref) {
    const theme = useThemeColors();
    const [position, setPosition] = useState<StoryPosition>({ progress: 0, chapter: undefined });
    useImperativeHandle(
      ref,
      () => ({
        set: (next) =>
          setPosition((current) => {
            const percent = Math.round(next.progress * 100);
            return percent === Math.round(current.progress * 100) &&
              next.chapter === current.chapter
              ? current
              : next;
          }),
      }),
      [],
    );
    const percent = Math.round(position.progress * 100);
    const name = position.chapter ?? title;

    return (
      <View
        style={[styles.bar, { backgroundColor: theme.canvas, borderBottomColor: theme.border }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Reading position: ${name}`}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        testID="story-progress"
      >
        {/* Chrome, not reading text: it grows with the system size, but not past two lines' worth. */}
        <Text
          variant="meta"
          colorRole="inkMuted"
          numberOfLines={1}
          maxFontSizeMultiplier={1.6}
          style={styles.name}
        >
          {name}
        </Text>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.accentGraphic }]}
          />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  bar: {
    gap: space['1'],
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  track: {
    height: 2,
  },
  fill: {
    height: 2,
  },
});
