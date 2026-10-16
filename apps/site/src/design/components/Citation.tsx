/**
 * Port of packages/ui/src/components/Citation.tsx and components.css `.ds-citation`.
 * Composes Notice for degraded links; links gain touch targets and token-driven focus rings.
 * Body metrics use $bodySm and configured tracking instead of literal source metrics.
 */
import type { ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';
import { focus } from '../tokens';
import { Notice } from './Notice';

export type CitationLinkStatus = 'alive' | 'redirected' | 'drifted' | 'dead';
export type CitationProps = {
  readonly label?: string;
  readonly source: string;
  readonly href?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly linkStatus?: CitationLinkStatus;
  readonly deadAsOfDate?: string;
  readonly archivedHref?: string;
  readonly trySearchingFor?: string;
};

const Frame = styled(YStack, {
  name: 'Citation',
  render: 'aside',
  gap: '$1',
  paddingVertical: '$3',
  paddingHorizontal: '$4',
  borderLeftWidth: 2,
  borderColor: '$borderStrong',
  borderTopRightRadius: '$sm',
  borderBottomRightRadius: '$sm',
  backgroundColor: '$surface',
  color: '$ink',
  variants: {} as const,
});

const Link = styled(SizableText, {
  name: 'CitationLink',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '$touch',
  fontFamily: '$body',
  fontSize: '$bodySm',
  color: '$ink',
  textDecorationLine: 'underline',
  focusVisibleStyle: {
    outlineColor: '$focusRing',
    outlineStyle: 'solid',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
  },
});

export function Citation({
  label = 'Source',
  source,
  href,
  children,
  className,
  linkStatus,
  deadAsOfDate,
  archivedHref,
  trySearchingFor,
}: CitationProps): ReactNode {
  return (
    <Frame aria-label={label} className={className}>
      <SizableText
        render="span"
        fontFamily="$mono"
        fontSize="$micro"
        fontWeight="500"
        textTransform="uppercase"
        color="$inkSubtle"
      >
        {label}
      </SizableText>
      {href ? (
        <Link render={<a href={href} rel="noopener noreferrer" />}>{source}</Link>
      ) : (
        <SizableText render="span" fontFamily="$body" fontSize="$bodySm" color="$ink">
          {source}
        </SizableText>
      )}
      {children}
      {linkStatus === 'dead' ? (
        <Notice
          tone="warning"
          title={
            archivedHref
              ? 'Original link unavailable — archived copy'
              : `Link dead${deadAsOfDate ? ` as of ${deadAsOfDate}` : ''}`
          }
        >
          {archivedHref ? (
            <SizableText
              render="p"
              margin={0}
              fontFamily="$body"
              fontSize="$bodySm"
              color="$warningFg"
            >
              <Link render={<a href={archivedHref} rel="noopener noreferrer" />}>
                View archived copy
              </Link>
              {deadAsOfDate ? (
                <SizableText render="span" fontFamily="$body" fontSize="$bodySm" color="$warningFg">
                  {' '}
                  · link dead as of {deadAsOfDate}
                </SizableText>
              ) : null}
            </SizableText>
          ) : null}
          {trySearchingFor ? (
            <SizableText
              render="p"
              margin={0}
              fontFamily="$body"
              fontSize="$bodySm"
              color="$warningFg"
            >
              {trySearchingFor}
            </SizableText>
          ) : null}
        </Notice>
      ) : null}
      {linkStatus === 'drifted' ? (
        <Notice tone="dispute" title="Content may have changed since capture">
          <SizableText
            render="p"
            margin={0}
            fontFamily="$body"
            fontSize="$bodySm"
            color="$disputeFg"
          >
            This link is reachable, but its current content no longer matches what was captured.
            Flagged for research review — the original capture remains the evidentiary anchor for
            this citation.
          </SizableText>
        </Notice>
      ) : null}
    </Frame>
  );
}
