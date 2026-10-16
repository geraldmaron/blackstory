/**
 * Port of packages/ui/src/components/Notice.tsx and components.css `.ds-notice`.
 * Flex replaces grid; the cue uses the nearest caption step and configured mono tracking.
 */
import type { ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { XStack, YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { VisuallyHidden } from './VisuallyHidden';

export type NoticeTone = 'warning' | 'dispute' | 'error';
export type NoticeProps = {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const CUES = { warning: 'Warning', dispute: 'Disputed', error: 'Error' } as const;
const FG = { warning: '$warningFg', dispute: '$disputeFg', error: '$errorFg' } as const;

const Frame = styled(XStack, {
  name: 'Notice',
  render: 'div',
  gap: '$3',
  alignItems: 'flex-start',
  padding: '$4',
  borderWidth: 1,
  borderRadius: '$md',
  variants: {
    tone: {
      warning: {
        color: '$warningFg',
        backgroundColor: '$warningBg',
        borderColor: '$warningBorder',
      },
      dispute: {
        color: '$disputeFg',
        backgroundColor: '$disputeBg',
        borderColor: '$disputeBorder',
      },
      error: { color: '$errorFg', backgroundColor: '$errorBg', borderColor: '$errorBorder' },
    },
  } as const,
});

export function Notice({ tone, title, children, className }: NoticeProps): ReactNode {
  return (
    <Frame tone={tone} role={tone === 'error' ? 'alert' : 'status'} className={className}>
      <SizableText
        render="span"
        aria-hidden
        fontFamily="$mono"
        fontSize="$caption"
        fontWeight="600"
        textTransform="uppercase"
        color={FG[tone]}
      >
        {CUES[tone]}
      </SizableText>
      <YStack flex={1} minWidth={0}>
        <SizableText
          render="p"
          margin={0}
          marginBottom="$1"
          fontFamily="$body"
          fontSize="$body"
          fontWeight="600"
          color={FG[tone]}
        >
          <VisuallyHidden>{CUES[tone]}: </VisuallyHidden>
          {title}
        </SizableText>
        <SizableText render="div" fontFamily="$body" fontSize="$bodySm" color={FG[tone]}>
          {children}
        </SizableText>
      </YStack>
    </Frame>
  );
}
