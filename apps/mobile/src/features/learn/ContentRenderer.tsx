/**
 * Structured content renderer (MOB-015 requirement #2).
 *
 * Renders ONLY the allowlisted `NormalizedBlock` shape `content-blocks.ts` produces — headings
 * and paragraphs, the two body-level primitives `ContentPageV1` actually defines in production
 * (`packages/public-contracts/src/v1/content.ts`). There is no branch anywhere in this component
 * that interprets a `type`/`tag`/HTML string and dispatches on it; unrecognized structure never
 * reaches this component at all because `normalizeContentPage` already dropped it upstream — this
 * component only ever sees the closed `NormalizedBlock` union, so "reject unknown block types" is
 * enforced at the type level here, not by a runtime `default:` case rendering raw content.
 *
 * Accessibility (requirement #7):
 *   - Heading hierarchy (Ledger Line): page title is level 1 (`entityTitle` / masthead),
 *     section headings are level 2 (`rowTitle`) — both get `isHeading`/`accessibilityRole="header"`
 *     from the `Text` primitive (MOB-007).
 *   - No `numberOfLines` / fixed heights anywhere here, so large Dynamic Type never clips body
 *     text (`Text`'s `allowFontScaling` stays on by default, per its own header comment).
 *   - RTL: no manual `left`/`right` positioning of text content; layout relies on RN's default
 *     writing-direction-aware flex flow, so Arabic/Hebrew content lays out correctly without
 *     special-casing.
 *   - "Table" semantics for related records: see `RelatedList.tsx`'s header comment.
 */
import { View } from 'react-native';
import { Link, Notice, RecordFactStrip, Text, space, useThemeColors } from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import type { NormalizedBlock, NormalizedPage } from './content-blocks';
import type { CitationV1 } from './content-types';
import { sanitizeExternalHref } from './link-safety';
import { RelatedEntityList, RelatedFactBadges } from './RelatedList';

export type ContentPresentation = 'document' | 'longform';

export interface ContentRendererProps {
  readonly page: NormalizedPage;
  readonly blocks: readonly NormalizedBlock[];
  readonly skippedSections: number;
  readonly sources?: readonly CitationV1[];
  readonly requiresCitation?: boolean;
  /** `longform` uses Source Serif body, generous measure, and calm chrome for narrative stories. */
  readonly presentation?: ContentPresentation;
  /** Freshness affordance (ADR-022 §3 / MOB-015 requirement #8). */
  readonly cached?: { readonly fetchedAt: number; readonly degraded: boolean };
  /** Legal/methodology version-mismatch affordance (MOB-015 requirement #4). */
  readonly versionStale?: boolean;
  readonly onViewCurrent?: () => void;
  /** When true, title/dek/facts render in the parent edition panel instead. */
  readonly hideTitle?: boolean;
  readonly headerFacts?: readonly { readonly key: string; readonly label: string; readonly value: string }[];
}

function formatRelativeTime(fetchedAtMs: number, nowMs: number = Date.now()): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
  if (diffSeconds < 60) return 'moments ago';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function Block({
  block,
  presentation,
}: {
  readonly block: NormalizedBlock;
  readonly presentation: ContentPresentation;
}) {
  if (block.kind === 'heading') {
    return (
      <Text
        variant="rowTitle"
        isHeading
        style={{
          marginTop: presentation === 'longform' ? space['5'] : space['4'],
          marginBottom: presentation === 'longform' ? space['2'] : space['1'],
        }}
      >
        {block.text}
      </Text>
    );
  }
  if (presentation === 'longform') {
    return (
      <Text variant="editorial" style={{ marginBottom: space['4'] }}>
        {block.text}
      </Text>
    );
  }
  return (
    <Text variant="body" style={{ marginBottom: space['3'] }}>
      {block.text}
    </Text>
  );
}

function SourcesList({ sources }: { readonly sources: readonly CitationV1[] }) {
  return (
    <View style={{ marginTop: space['4'], gap: space['1'] }} accessible={false}>
      <Text variant="sectionLabel" colorRole="inkMuted" isHeading accessibilityRole="header" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
        Sources
      </Text>
      {sources.map((source, index) => {
        const safeHref = source.href ? sanitizeExternalHref(source.href) : null;
        return (
          <View key={`${source.source}-${index}`} style={{ marginTop: space['1'] }}>
            {safeHref ? (
              <Link href={safeHref} accessibilityLabel={`${source.label}, opens ${source.source}`}>
                {source.label}
              </Link>
            ) : (
              <Text variant="bodySmall" colorRole="inkMuted">
                {source.label}
                {source.withheldReason ? ` · ${source.withheldReason}` : ''}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function ContentRenderer({
  page,
  blocks,
  skippedSections,
  sources,
  requiresCitation,
  presentation = 'document',
  cached,
  versionStale,
  onViewCurrent,
  hideTitle = false,
  headerFacts,
}: ContentRendererProps) {
  const theme = useThemeColors();
  const hasSources = Boolean(sources && sources.length > 0);
  const isLongform = presentation === 'longform';
  const showCacheNotice = cached && (!isLongform || cached.degraded);
  const facts =
    headerFacts ??
    [
      ...(page.eraLabel
        ? [{ key: 'era', label: 'Era', value: plainRangeText(page.eraLabel) }]
        : []),
      ...(page.placeLabel ? [{ key: 'where', label: 'Where', value: page.placeLabel }] : []),
    ];

  return (
    <View style={{ gap: isLongform ? space['2'] : space['1'], maxWidth: isLongform ? 672 : undefined }}>
      {!hideTitle ? (
        <>
          <Text variant="entityTitle" isHeading>
            {page.title}
          </Text>
          {page.dek ? (
            <Text
              variant={isLongform ? 'editorial' : 'caption'}
              colorRole="inkMuted"
              style={{ marginBottom: isLongform ? space['4'] : space['2'] }}
            >
              {page.dek}
            </Text>
          ) : null}
        </>
      ) : null}
      {facts.length > 0 ? (
        <RecordFactStrip
          facts={facts.map((fact) => ({
            ...fact,
            value: fact.label === 'Era' ? plainRangeText(fact.value) : fact.value,
          }))}
        />
      ) : null}

      {showCacheNotice ? (
        <Notice
          tone="info"
          title={cached.degraded ? 'Showing cached copy (offline)' : 'Up to date'}
          description={`Last updated ${formatRelativeTime(cached.fetchedAt)}`}
        />
      ) : null}

      {versionStale ? (
        <Notice
          tone="warning"
          title="This version may be outdated"
          description="A newer version of this document is available."
        />
      ) : null}

      <View style={{ marginTop: space['2'] }}>
        {blocks.map((block, index) => (
          <Block key={index} block={block} presentation={presentation} />
        ))}
      </View>

      {skippedSections > 0 ? (
        <Notice
          tone="info"
          title="Some content was skipped"
          description={`${skippedSections} unsupported item${skippedSections === 1 ? '' : 's'} could not be shown.`}
        />
      ) : null}

      {requiresCitation && !hasSources ? (
        <Notice
          tone="dispute"
          title="No cited sources"
          description="This page has no attached sources. Treat its claims as unverified until sources are added."
        />
      ) : null}

      {hasSources ? <SourcesList sources={sources!} /> : null}

      {isLongform && (page.relatedEntityIds.length > 0 || page.relatedFactIds.length > 0) ? (
        <View
          style={{
            marginTop: space['6'],
            paddingTop: space['4'],
            borderTopWidth: 1,
            borderTopColor: theme.border,
            gap: space['4'],
          }}
        >
          <RelatedEntityList entityIds={page.relatedEntityIds} />
          <RelatedFactBadges factIds={page.relatedFactIds} />
        </View>
      ) : (
        <>
          <RelatedEntityList entityIds={page.relatedEntityIds} />
          <RelatedFactBadges factIds={page.relatedFactIds} />
        </>
      )}

      {versionStale && onViewCurrent ? (
        <Link href="#" onPress={onViewCurrent} accessibilityLabel="View current version">
          View current
        </Link>
      ) : null}
    </View>
  );
}
