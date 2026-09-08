/**
 * Record anatomy (beat 01): place preview, then Kind / Where / Era / Evidence as labelled rows,
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
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
  type RecordAnatomyPlace,
} from '../entity-anatomy-facts';
import { openExternalMaps } from '../maps-handoff';
import type { Entity } from '../types';
import { EditionFactIcon, type EditionFactIconProps } from '../edition-fact-icon';
import {
  RecordBeatRow,
  recordBeatLabelColumnWidth,
  recordBeatRowStyle,
} from '../RecordBeatRow';
import { RecordPlacePreview } from '../record-place-preview';

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

export function AnatomySection({ entity, onBackToMap }: AnatomySectionProps) {
  const [mapsError, setMapsError] = useState<string | undefined>(undefined);
  const place = buildEntityAnatomyPlace(entity);
  const inputs = buildEntityAnatomyInputs(entity);
  const facts = factsFor(entity);
  const hasPublicAnchor = place !== undefined;

  async function handleOpenInMaps(fromPlace?: RecordAnatomyPlace) {
    const anchor = fromPlace ?? place;
    if (!anchor) {
      setMapsError('No public coordinates are available for this record yet.');
      return;
    }
    setMapsError(undefined);
    const result = await openExternalMaps({
      lat: anchor.lat,
      lng: anchor.lng,
      ...(entity.displayName ? { label: entity.displayName } : {}),
    });
    if (result !== 'opened') {
      setMapsError('Could not open Maps. Try again, or use View on national map inside BlackStory.');
    }
  }

  return (
    <EntityEditionPanel
      index="01"
      kicker="Anatomy"
      title="Record at a glance"
      testID="entity-anatomy-section"
    >
      <RecordPlacePreview
        place={place}
        {...(hasPublicAnchor
          ? {
              onOpenInMaps: () => {
                void handleOpenInMaps();
              },
            }
          : {})}
      />

      <View style={styles.factsList} accessibilityLabel="Record anatomy">
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
                      showLetter={false}
                      decorative
                      testID="entity-anatomy-evidence-meter"
                    />
                  ),
                }
              : {})}
            {...(fact.key === 'where' && hasPublicAnchor
              ? {
                  onPress: () => {
                    void handleOpenInMaps();
                  },
                  accessibilityLabel: `Where: ${fact.value}. Open in Maps at public precision.`,
                }
              : {})}
          />
        ))}
      </View>

      {/* A sentence, so it is set in the body face. Mono is for data and citations; three lines
          of monospaced prose read as a console log sitting under the record. */}
      {place?.precisionCaption ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          {place.precisionCaption}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {hasPublicAnchor ? (
          <Button
            label="Open in maps"
            variant="accent"
            density="compact"
            accessibilityLabel={`Open ${entity.locationLabel || entity.displayName} in Maps at public precision`}
            onPress={() => {
              void handleOpenInMaps();
            }}
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

      {mapsError ? <Notice tone="info" title="Maps unavailable" description={mapsError} /> : null}
    </EntityEditionPanel>
  );
}

/** The row layout is `RecordBeatRow`'s now; these stay as the anatomy beat's contract names. */
export const anatomyFactRowStyle = recordBeatRowStyle;
export const anatomyFactLabelColumnWidth = recordBeatLabelColumnWidth;

const styles = StyleSheet.create({
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
