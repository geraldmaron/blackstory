/**
 * Provenance: how far this record has been worked, and when it last changed.
 *
 * This beat used to be a paragraph — "Maturity: Partial Enrichment. Research coverage: Minimal.
 * Maturity labels follow the product constitution vocabulary." — which buried two labeled facts
 * inside a sentence and then explained the vocabulary to a reader who never asked. Both facts are
 * fields, so they are rows in the same rhythm the anatomy beat uses, and coverage carries the
 * shared meter. The vocabulary sentence is gone: it addressed the archive, not the reader.
 */
import { StyleSheet, View } from 'react-native';

import { RecordMeter, Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordBeatRow } from '../RecordBeatRow';
import { formatIsoDate, humanizeToken } from '../format';
import type { Entity } from '../types';

const COVERAGE_LEVELS = ['minimal', 'partial', 'substantial'] as const;
type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

function coverageLevel(value: string | undefined): CoverageLevel | undefined {
  const normalized = value?.trim().toLowerCase();
  return COVERAGE_LEVELS.find((level) => level === normalized);
}

function tracked(value: string): string {
  return value.trim().length > 0 ? formatIsoDate(value) : 'Not yet tracked';
}

export type ProvenanceSectionProps = {
  readonly entity: Entity;
  readonly index: string;
};

export function ProvenanceSection({ entity, index }: ProvenanceSectionProps) {
  const coverage = coverageLevel(entity.researchCoverage);

  return (
    <EntityEditionPanel
      index={index}
      kicker="Provenance"
      title="How complete this record is"
      testID="entity-provenance-section"
    >
      <View style={styles.rows}>
        <RecordBeatRow
          label="Maturity"
          value={humanizeToken(entity.recordMaturity || 'unknown')}
          testID="entity-provenance-maturity"
        />
        <RecordBeatRow
          label="Coverage"
          value={humanizeToken(entity.researchCoverage || 'unknown')}
          testID="entity-provenance-coverage"
          {...(coverage
            ? {
                trailing: (
                  <RecordMeter
                    coverage={coverage}
                    decorative
                    testID="entity-provenance-coverage-meter"
                  />
                ),
              }
            : {})}
        />
      </View>

      <View style={styles.rows}>
        {entity.revision.releaseId ? (
          <RecordBeatRow
            label="Release"
            valueNode={
              <Text variant="code" colorRole="inkMuted" style={styles.dataValue}>
                {entity.revision.releaseId}
              </Text>
            }
            testID="entity-provenance-release"
          />
        ) : null}
        <RecordBeatRow
          label="Updated"
          valueNode={
            <Text variant="code" colorRole="inkMuted" style={styles.dataValue}>
              {tracked(entity.revision.recordUpdatedAt)}
            </Text>
          }
          testID="entity-provenance-updated"
        />
        <RecordBeatRow
          label="Generated"
          valueNode={
            <Text variant="code" colorRole="inkMuted" style={styles.dataValue}>
              {tracked(entity.revision.generatedAt)}
            </Text>
          }
          testID="entity-provenance-generated"
        />
      </View>
    </EntityEditionPanel>
  );
}

const styles = StyleSheet.create({
  rows: {
    flexDirection: 'column',
    gap: space['2'],
    minWidth: 0,
  },
  dataValue: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
});
