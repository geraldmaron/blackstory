/**
 * "Why this appears" (relevance), "Historical context", and "Further reading" (extended
 * narrative) — mirrors `apps/web/src/app/entity/[id]/page.tsx`'s section order and headings.
 * Every text field renders through `@/ui`'s `Text`, which (like all RN `Text`) never interprets
 * HTML/markup in its children — a malicious `<script>`/Unicode-direction-override payload in
 * `relevanceExplanation`/`historicalContext`/`extendedNarrative` renders as inert literal text
 * by construction, not by any escaping this module has to perform itself.
 */
import { View } from 'react-native';
import { EmptyState, Text, space } from '@/ui';
import { RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import { MAX_EXTENDED_NARRATIVE_CHARS } from '../types';
import type { Entity } from '../types';
import { SectionHeading } from './SectionHeading';

export type NarrativeSectionsProps = {
  readonly entity: Entity;
};

export function NarrativeSections({ entity }: NarrativeSectionsProps) {
  const narrative = entity.extendedNarrative;
  const narrativeTruncated = narrative !== undefined && narrative.length >= MAX_EXTENDED_NARRATIVE_CHARS;

  return (
    <View style={{ gap: space['6'] }}>
      <View style={{ gap: space['2'] }}>
        <SectionHeading level={2}>{SECTION_HEADINGS.relevance}</SectionHeading>
        {entity.relevanceExplanation.trim().length > 0 ? (
          <Text variant="body">{entity.relevanceExplanation}</Text>
        ) : (
          <EmptyState title={RECORD_GAP_COPY.relevance.title} description={RECORD_GAP_COPY.relevance.body} />
        )}
      </View>

      <View style={{ gap: space['2'] }}>
        <SectionHeading level={2}>{SECTION_HEADINGS.context}</SectionHeading>
        {entity.historicalContext.trim().length > 0 ? (
          <Text variant="body">{entity.historicalContext}</Text>
        ) : (
          <EmptyState title={RECORD_GAP_COPY.context.title} description={RECORD_GAP_COPY.context.body} />
        )}
      </View>

      {narrative ? (
        <View style={{ gap: space['2'] }}>
          <SectionHeading level={2}>{SECTION_HEADINGS.furtherReading}</SectionHeading>
          <Text variant="body">{narrative}</Text>
          {narrativeTruncated ? (
            <Text variant="caption" colorRole="inkMuted">
              This passage has been shortened for display.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
