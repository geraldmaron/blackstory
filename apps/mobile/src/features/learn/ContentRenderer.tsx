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
 *   - Heading hierarchy: page title is level 1 (`variant="title"`), section headings are level 2
 *     (`variant="subtitle"`) — both get `isHeading`/`accessibilityRole="header"` from the `Text`
 *     primitive (MOB-007).
 *   - No `numberOfLines` / fixed heights anywhere here, so large Dynamic Type never clips body
 *     text (`Text`'s `allowFontScaling` stays on by default, per its own header comment).
 *   - RTL: no manual `left`/`right` positioning of text content; layout relies on RN's default
 *     writing-direction-aware flex flow, so Arabic/Hebrew content lays out correctly without
 *     special-casing.
 *   - "Table" semantics for related records: see `RelatedList.tsx`'s header comment.
 */
import { View } from 'react-native';
import { Link, Notice, Text } from '@/ui';
import type { NormalizedBlock, NormalizedPage } from './content-blocks';
import type { CitationV1 } from './content-types';
import { sanitizeExternalHref } from './link-safety';
import { RelatedEntityList, RelatedFactBadges } from './RelatedList';

export interface ContentRendererProps {
  readonly page: NormalizedPage;
  readonly blocks: readonly NormalizedBlock[];
  readonly skippedSections: number;
  readonly sources?: readonly CitationV1[];
  readonly requiresCitation?: boolean;
  /** Freshness affordance (ADR-022 §3 / MOB-015 requirement #8). */
  readonly cached?: { readonly fetchedAt: number; readonly degraded: boolean };
  /** Legal/methodology version-mismatch affordance (MOB-015 requirement #4). */
  readonly versionStale?: boolean;
  readonly onViewCurrent?: () => void;
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

function Block({ block }: { readonly block: NormalizedBlock }) {
  if (block.kind === 'heading') {
    return (
      <Text variant="subtitle" isHeading style={{ marginTop: 16, marginBottom: 4 }}>
        {block.text}
      </Text>
    );
  }
  return (
    <Text variant="body" style={{ marginBottom: 12 }}>
      {block.text}
    </Text>
  );
}

function SourcesList({ sources }: { readonly sources: readonly CitationV1[] }) {
  return (
    <View style={{ marginTop: 16, gap: 4 }} accessible={false}>
      <Text variant="subtitle" isHeading accessibilityRole="header">
        Sources
      </Text>
      {sources.map((source, index) => {
        const safeHref = source.href ? sanitizeExternalHref(source.href) : null;
        return (
          <View key={`${source.source}-${index}`} style={{ marginTop: 4 }}>
            {safeHref ? (
              <Link href={safeHref} accessibilityLabel={`${source.label}, opens ${source.source}`}>
                {source.label}
              </Link>
            ) : (
              <Text variant="bodySmall" colorRole="inkMuted">
                {source.label}
                {source.withheldReason ? ` — ${source.withheldReason}` : ''}
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
  cached,
  versionStale,
  onViewCurrent,
}: ContentRendererProps) {
  const hasSources = Boolean(sources && sources.length > 0);

  return (
    <View style={{ gap: 4 }}>
      <Text variant="title" isHeading>
        {page.title}
      </Text>
      {page.dek ? (
        <Text variant="bodyEmphasis" colorRole="inkMuted" style={{ marginBottom: 8 }}>
          {page.dek}
        </Text>
      ) : null}
      {page.eraLabel || page.placeLabel ? (
        <Text variant="bodySmall" colorRole="inkSubtle" style={{ marginBottom: 12 }}>
          {[page.eraLabel, page.placeLabel].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {cached ? (
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

      <View style={{ marginTop: 8 }}>
        {blocks.map((block, index) => (
          <Block key={index} block={block} />
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
          description="This page has no attached sources — treat its claims as unverified until sources are added."
        />
      ) : null}

      {hasSources ? <SourcesList sources={sources!} /> : null}

      <RelatedEntityList entityIds={page.relatedEntityIds} />
      <RelatedFactBadges factIds={page.relatedFactIds} />

      {versionStale && onViewCurrent ? (
        <Link href="#" onPress={onViewCurrent} accessibilityLabel="View current version">
          View current
        </Link>
      ) : null}
    </View>
  );
}
