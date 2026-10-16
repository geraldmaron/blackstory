/** Port of packages/ui/src/components/Pagination.tsx and workbench.css.
 * Targets grow to $touch; the current page also has an underline. */
import { styled } from '@tamagui/core';
import { XStack, YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { focus } from '../tokens';

export type PaginationProps = {
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hrefForPage: (page: number) => string;
  readonly itemLabel?: string;
  readonly className?: string;
};

export function pageWindow(page: number, pageCount: number): readonly (number | 'gap')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) out.push('gap');
    out.push(value);
    previous = value;
  }
  return out;
}

const Frame = styled(XStack, {
  name: 'Pagination',
  render: 'nav',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$3',
});
const Pages = styled(XStack, {
  render: 'ul',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '$1',
  margin: 0,
  padding: 0,
});
const PageLink = styled(SizableText, {
  render: 'a',
  fontFamily: '$body',
  fontSize: '$caption',
  color: '$ink',
  minHeight: '$touch',
  minWidth: '$touch',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: '$1',
  paddingHorizontal: '$2',
  borderWidth: 1,
  borderColor: '$canvas',
  borderRadius: '$sm',
  textDecorationLine: 'none',
  hoverStyle: { borderColor: '$border' },
  focusVisibleStyle: {
    outlineColor: '$focusRing',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
    outlineStyle: 'solid',
  },
  variants: {
    current: {
      true: { borderColor: '$borderStrong', fontWeight: '600', textDecorationLine: 'underline' },
    },
    inactive: { true: { opacity: 0.4, pointerEvents: 'none' } },
  } as const,
});

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  hrefForPage,
  itemLabel = 'results',
  className,
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <Frame className={className} aria-label="Pagination">
      <SizableText render="p" margin={0} fontFamily="$mono" fontSize="$caption" color="$inkMuted">
        {total === 0
          ? `No ${itemLabel}`
          : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()} ${itemLabel}`}
      </SizableText>
      {pageCount > 1 ? (
        <Pages>
          <YStack render="li">
            {page === 1 ? (
              // Not a link at the ends: a disabled-looking anchor with an href is still a tab stop and Enter follows it.
              <PageLink render="span" aria-disabled="true" inactive>
                ← Prev
              </PageLink>
            ) : (
              <PageLink href={hrefForPage(Math.max(1, page - 1))} rel="prev">
                ← Prev
              </PageLink>
            )}
          </YStack>
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <SizableText
                render="li"
                key={`gap-${index}`}
                aria-hidden
                fontFamily="$body"
                fontSize="$caption"
                color="$inkMuted"
              >
                …
              </SizableText>
            ) : (
              <YStack render="li" key={entry}>
                <PageLink
                  href={hrefForPage(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  current={entry === page}
                >
                  {entry}
                </PageLink>
              </YStack>
            ),
          )}
          <YStack render="li">
            {page === pageCount ? (
              <PageLink render="span" aria-disabled="true" inactive>
                Next →
              </PageLink>
            ) : (
              <PageLink href={hrefForPage(Math.min(pageCount, page + 1))} rel="next">
                Next →
              </PageLink>
            )}
          </YStack>
        </Pages>
      ) : null}
    </Frame>
  );
}
