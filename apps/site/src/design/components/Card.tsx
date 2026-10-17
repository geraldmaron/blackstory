/**
 * Port of packages/ui/src/components/Card.tsx and components.css `.ds-card`.
 * Title/meta metrics use the nearest type steps; interactive also responds to focus within.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';

export type CardProps = HTMLAttributes<HTMLElement> & {
  readonly title?: string;
  readonly meta?: ReactNode;
  readonly interactive?: boolean;
  readonly as?: 'article' | 'section' | 'div';
  readonly children: ReactNode;
};

const Frame = styled(YStack, {
  name: 'Card',
  backgroundColor: '$surfaceRaised',
  color: '$ink',
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$md',
  padding: '$5',
  variants: {
    interactive: {
      true: {
        hoverStyle: { borderColor: '$borderStrong' },
        focusWithinStyle: { borderColor: '$borderStrong' },
      },
    },
  } as const,
});

export function Card({
  title,
  meta,
  interactive = false,
  as: Component = 'article',
  className,
  children,
  ...rest
}: CardProps): ReactNode {
  return (
    <Frame render={<Component {...rest} />} interactive={interactive} className={className}>
      {title ? (
        <SizableText
          render="h3"
          margin={0}
          marginBottom="$2"
          fontFamily="$heading"
          fontSize="$title"
          fontWeight="650"
          color="$ink"
        >
          {title}
        </SizableText>
      ) : null}
      {meta ? (
        <SizableText
          render="div"
          marginBottom="$3"
          fontFamily="$mono"
          fontSize="$caption"
          color="$inkSubtle"
        >
          {meta}
        </SizableText>
      ) : null}
      {children}
    </Frame>
  );
}
