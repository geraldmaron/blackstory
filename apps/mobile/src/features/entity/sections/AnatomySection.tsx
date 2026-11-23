/**
 * Record anatomy (beat 01): place preview, then Kind / Where / Era / Evidence as labeled rows,
 * and the maps hand-off.
 *
 * Evidence carries the shared meter beside its grade, so the record page states its assessment
 * the way the map sheet, the rail row and the site all state it. The grade word used to come from
 * a third private copy of the tier vocabulary living in `entity-anatomy-facts.ts`.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Notice, RecordMeter, Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { buildEntityAnatomyInputs, buildEntityAnatomyPlace } from '../entity-anatomy-facts';
import { openExternalMaps } from '../maps-handoff';
import type { Entity } from '../types';
import { EditionFactIcon, type EditionFactIconProps } from '../edition-fact-icon';
import { RecordBeatRow, recordBeatLabelColumnWidth, recordBeatRowStyle } from '../RecordBeatRow';
import { RecordPlacePreview } from '../record-place-preview';
import { isQuietRecord } from '../entity-view-model';

export type AnatomySectionProps = {
  readonly entity: Entity;
  readonly onBackToMap?: () => void;
};

type AnatomyFact = {
  readonly key: 'kind' | 'where' | 'era' | 'evidence';
  readonly label: string;
  readonly value: string;
  readonly icon: EditionFactIconProps;
};

function factsFor(entity: Entity): readonly AnatomyFact[] {
  const inputs = buildEntityAnatomyInputs(entity);
  return [
    {
      key: 'kind',
      label: 'Kind',
      value: inputs.kindLabel,
      icon: { variant: 'record-kind', kind: inputs.kind, muted: true },
    },
    {
      key: 'where',
      label: 'Where',
      value: inputs.whereLabel,
      icon: { variant: 'record-where' },
    },
    {
      key: 'era',
      label: 'Era',
      value: inputs.eraLabel,
      icon: { variant: 'record-era' },
    },
    {
      key: 'evidence',
      label: 'Evidence',
      value: inputs.evidenceLabel,
      icon: { variant: 'record-evidence', tier: inputs.evidenceTier },
    },
  ];
}

/** Hands the record's public anchor to the device's maps app, and says so when it cannot. */
function useOpenInMaps(entity: Entity) {
  const [error, setError] = useState<string | undefined>(undefined);
  const place = buildEntityAnatomyPlace(entity);

  async function open() {
    if (!place) {
      setError('No public coordinates are available for this record yet.');
      return;
    }
    setError(undefined);
    const result = await openExternalMaps({
      lat: place.lat,
      lng: place.lng,
      ...(entity.displayName ? { label: entity.displayName } : {}),
    });
    if (result !== 'opened') {
      setError('Could not open Maps. Try again, or use View on national map inside BlackStory.');
    }
  }

  return { place, open, error };
}

/**
 * The record's map exhibit with its precision in words and the two ways onward. It leads the
 * record when there is no photograph and follows the claims when there is one.
 */
export function RecordMapSection({ entity, onBackToMap }: AnatomySectionProps) {
  const { place, open, error } = useOpenInMaps(entity);

  return (
    <View style={styles.map} testID="entity-map-section">
      <RecordPlacePreview
        place={place}
        quiet={isQuietRecord(entity)}
        {...(place ? { onOpenInMaps: () => void open() } : {})}
      />

      {/* A sentence, so it is set in the body face. Mono is for data and citations. */}
      {place?.precisionCaption ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          {place.precisionCaption}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {place ? (
          <Button
            label="Open in maps"
            variant="secondary"
            density="compact"
            accessibilityLabel={`Open ${entity.locationLabel || entity.displayName} in Maps at public precision`}
            onPress={() => void open()}
          />
        ) : null}
        {onBackToMap ? (
          <Button
            label="View on national map"
            variant="secondary"
            density="compact"
            accessibilityLabel={`View ${entity.displayName} on the national map`}
            onPress={onBackToMap}
          />
        ) : null}
      </View>

      {error ? <Notice tone="info" title="Maps unavailable" description={error} /> : null}
    </View>
  );
}

/** The record at a glance: kind, where, era and evidence as a ruled list. */
export function AnatomySection({ entity }: Pick<AnatomySectionProps, 'entity'>) {
  const { place, open, error } = useOpenInMaps(entity);
  const inputs = buildEntityAnatomyInputs(entity);
  const facts = factsFor(entity);

  return (
    <EntityEditionPanel
      kicker="At a glance"
      title="Record at a glance"
      testID="entity-anatomy-section"
    >
      <View style={styles.factsList} accessibilityLabel="Record at a glance">
        {facts.map((fact) => (
          <RecordBeatRow
            key={fact.key}
            label={fact.label}
            leading={<EditionFactIcon {...fact.icon} />}
            value={fact.value}
            testID={`entity-anatomy-fact-${fact.key}`}
            labelTestID={`entity-anatomy-fact-label-${fact.key}`}
            {...(fact.key === 'evidence'
              ? {
                  trailing: (
                    <RecordMeter
                      tier={inputs.evidenceTier}
                      decorative
                      testID="entity-anatomy-evidence-meter"
                    />
                  ),
                }
              : {})}
            {...(fact.key === 'where' && place
              ? {
                  onPress: () => void open(),
                  accessibilityLabel: `Where: ${fact.value}. Open in Maps at public precision.`,
                }
              : {})}
          />
        ))}
      </View>
      {error ? <Notice tone="info" title="Maps unavailable" description={error} /> : null}
    </EntityEditionPanel>
  );
}

export const anatomyFactRowStyle = recordBeatRowStyle;
export const anatomyFactLabelColumnWidth = recordBeatLabelColumnWidth;

const styles = StyleSheet.create({
  map: {
    gap: space['3'],
  },
  factsList: {
    flexDirection: 'column',
    gap: space['2'],
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
});
