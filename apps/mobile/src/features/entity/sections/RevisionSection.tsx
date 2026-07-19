/**
 * Record maturity + revision provenance — mirrors web's entity-page aside ("Record maturity",
 * "Revision" with "Record last updated" / "Release generated", falling back to "Not yet
 * tracked" for an honestly-empty timestamp per `revision.ts`'s own doc comment: "may be `''` on
 * pre-release-builder bootstrap stubs — an honest 'unknown', never a fabricated 'now'").
 */
import { View } from 'react-native';
import { Text, space } from '@/ui';
import { SECTION_HEADINGS } from '../copy';
import { formatIsoDate } from '../format';
import type { Entity } from '../types';
import { SectionHeading } from './SectionHeading';

function tracked(value: string): string {
  return value.trim().length > 0 ? formatIsoDate(value) : 'Not yet tracked';
}

export type RevisionSectionProps = {
  readonly entity: Entity;
};

export function RevisionSection({ entity }: RevisionSectionProps) {
  return (
    <View style={{ gap: space['3'] }}>
      {entity.recordMaturity ? (
        <View style={{ gap: space['1'] }}>
          <SectionHeading level={2}>{SECTION_HEADINGS.maturity}</SectionHeading>
          <Text variant="bodySmall">{entity.recordMaturity}</Text>
          {entity.researchCoverage ? (
            <Text variant="caption" colorRole="inkMuted">
              Research coverage: {entity.researchCoverage}.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space['1'] }}>
        <SectionHeading level={2}>{SECTION_HEADINGS.revision}</SectionHeading>
        {entity.revision.releaseId ? (
          <Text variant="caption" colorRole="inkMuted">
            {entity.revision.releaseId}
          </Text>
        ) : null}
        <Text variant="bodySmall" colorRole="inkMuted">
          Record last updated: {tracked(entity.revision.recordUpdatedAt)}
        </Text>
        <Text variant="bodySmall" colorRole="inkMuted">
          Release generated: {tracked(entity.revision.generatedAt)}
        </Text>
      </View>
    </View>
  );
}
