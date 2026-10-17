/** Port of packages/ui/src/components/ResultList.tsx and components.css.
 * Uses a solid surface hover role and nearest type steps; route-specific overrides stay with routes. */
import type { ComponentType, ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { focus } from '../tokens';

export type ResultItem = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly meta?: ReactNode;
};
export type ResultListLinkProps = {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
};
export type ResultListProps = {
  readonly items: readonly ResultItem[];
  readonly className?: string;
  readonly labelledBy?: string;
  readonly LinkComponent?: ComponentType<ResultListLinkProps>;
};
function DefaultResultLink({ href, className, children }: ResultListLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
const Frame = styled(YStack, {
  name: 'ResultList',
  render: 'ul',
  margin: 0,
  padding: 0,
  borderTopWidth: 1,
  borderTopColor: '$border',
});
const Item = styled(YStack, { render: 'li', borderBottomWidth: 1, borderBottomColor: '$border' });
// A text primitive, not a View: only a Text carries textDecorationLine to the <a>, and the UA underline
// on an anchor cannot be cancelled by its descendants.
const LinkFrame = styled(SizableText, {
  display: 'flex',
  flexDirection: 'column',
  gap: '$2',
  paddingVertical: '$5',
  minHeight: '$touch',
  textDecorationLine: 'none',
  hoverStyle: { backgroundColor: '$surface' },
  focusVisibleStyle: {
    outlineColor: '$focusRing',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
    outlineStyle: 'solid',
  },
});
export function ResultList({
  items,
  className,
  labelledBy,
  LinkComponent = DefaultResultLink,
}: ResultListProps) {
  return (
    <Frame className={className} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <Item key={item.id}>
          <LinkFrame render={<LinkComponent href={item.href}>{null}</LinkComponent>}>
            <SizableText
              render="h3"
              margin={0}
              fontFamily="$heading"
              fontSize="$body"
              fontWeight="500"
              color="$ink"
            >
              {item.title}
            </SizableText>
            <SizableText
              render="p"
              margin={0}
              fontFamily="$body"
              fontSize="$bodySm"
              color="$inkMuted"
            >
              {item.summary}
            </SizableText>
            {item.meta ? (
              <SizableText
                render="div"
                display="flex"
                flexDirection="row"
                flexWrap="wrap"
                gap="$2"
                alignItems="center"
                marginTop="$3"
                fontFamily="$mono"
                fontSize="$caption"
                color="$inkSubtle"
              >
                {item.meta}
              </SizableText>
            ) : null}
          </LinkFrame>
        </Item>
      ))}
    </Frame>
  );
}
