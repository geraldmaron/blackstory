/** Port of packages/ui/src/components/Timeline.tsx and components.css.
 * Markers sit inside the rule, offsets and time type use scale steps. Route overrides stay with routes. */
import type { ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';

export type TimelineItem = {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly body?: ReactNode;
};
export type TimelineProps = {
  readonly items: readonly TimelineItem[];
  readonly className?: string;
  readonly labelledBy?: string;
};
const Frame = styled(YStack, {
  name: 'Timeline',
  render: 'ol',
  margin: 0,
  padding: 0,
  borderLeftWidth: 2,
  borderLeftColor: '$border',
});
const Item = styled(YStack, {
  render: 'li',
  position: 'relative',
  paddingLeft: '$5',
  paddingBottom: '$5',
  variants: { last: { true: { paddingBottom: 0 } } } as const,
});
const Marker = styled(YStack, {
  render: 'span',
  position: 'absolute',
  left: 0,
  top: '$1',
  width: '$3',
  height: '$3',
  borderRadius: '$full',
  backgroundColor: '$ink',
  borderWidth: 2,
  borderColor: '$canvas',
});
export function Timeline({ items, className, labelledBy }: TimelineProps) {
  return (
    <Frame className={className} aria-labelledby={labelledBy}>
      {items.map((item, index) => (
        <Item key={item.id} last={index === items.length - 1}>
          <Marker aria-hidden />
          <SizableText
            render="time"
            {...{ dateTime: item.time }}
            marginBottom="$1"
            fontFamily="$mono"
            fontSize="$caption"
            color="$inkSubtle"
          >
            {item.time}
          </SizableText>
          <SizableText
            render="h3"
            margin={0}
            marginBottom="$1"
            fontFamily="$heading"
            fontSize="$body"
            fontWeight="600"
            color="$ink"
          >
            {item.title}
          </SizableText>
          {item.body ? (
            <SizableText render="div" fontFamily="$body" fontSize="$bodySm" color="$inkMuted">
              {item.body}
            </SizableText>
          ) : null}
        </Item>
      ))}
    </Frame>
  );
}
