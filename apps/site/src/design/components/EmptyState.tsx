/**
 * Port of packages/ui/src/components/EmptyState.tsx and components.css `.ds-empty`.
 * The title uses $title; the body width rounds to $48 because there is no source-width token.
 */
import type { ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { measure } from '../tokens';

export type EmptyStateProps = {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
};

const Frame = styled(YStack, {
  name: 'EmptyState',
  render: 'div',
  role: 'status',
  gap: '$3',
  alignItems: 'flex-start',
  paddingVertical: '$8',
  paddingHorizontal: '$5',
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: '$borderStrong',
  borderRadius: '$md',
  backgroundColor: '$surface',
  variants: {} as const,
});

export function EmptyState({ title, children, action, className }: EmptyStateProps): ReactNode {
  return (
    <Frame className={className}>
      <SizableText
        render="h2"
        margin={0}
        fontFamily="$heading"
        fontSize="$title"
        fontWeight="600"
        color="$ink"
      >
        {title}
      </SizableText>
      <SizableText
        render="div"
        maxWidth={measure.body}
        fontFamily="$body"
        fontSize="$body"
        color="$inkMuted"
      >
        {children}
      </SizableText>
      {action}
    </Frame>
  );
}
