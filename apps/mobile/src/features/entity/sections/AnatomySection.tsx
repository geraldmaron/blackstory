/**
 * v6 record anatomy panel (beat 01): place preview, Kind / Where / Era /
 * Evidence facts with EditionFactIcon labels, and maps hand-off CTAs.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Notice, Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
  type RecordAnatomyPlace,
} from '../entity-anatomy-facts';
import { openMapsAtPublicAnchor } from '../maps-handoff';
import type { Entity } from '../types';
import { EditionFactIcon, type EditionFactIconProps } from '../edition-fact-icon';
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
  const facts = factsFor(entity);
  const hasPublicAnchor = place !== undefined;

  async function handleOpenInMaps(fromPlace?: RecordAnatomyPlace) {
    const anchor = fromPlace ?? place;
    if (!anchor) {
      setMapsError('No public coordinates are available for this record yet.');
      return;
    }
    setMapsError(undefined);
    const result = await openMapsAtPublicAnchor(anchor.lat, anchor.lng);
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

      <View style={styles.factsGrid} accessibilityLabel="Record anatomy">
        {facts.map((fact) => (
          <View key={fact.key} style={styles.factCell}>
            <View style={styles.labelRow}>
              <EditionFactIcon {...fact.icon} />
              <Text variant="caption" colorRole="inkSubtle" style={styles.labelText}>
                {fact.label}
              </Text>
            </View>
            {fact.key === 'where' && hasPublicAnchor ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Where: ${fact.value}. Open in Maps at public precision.`}
                hitSlop={8}
                onPress={() => {
                  void handleOpenInMaps();
                }}
                style={({ pressed }) => [styles.whereValue, pressed ? styles.wherePressed : null]}
              >
                <Text variant="editorial" colorRole="accent" numberOfLines={3}>
                  {fact.value}
                </Text>
              </Pressable>
            ) : (
              <Text variant="editorial" colorRole="ink" numberOfLines={3}>
                {fact.value}
              </Text>
            )}
          </View>
        ))}
      </View>

      {place?.precisionCaption ? (
        <Text variant="code" colorRole="inkMuted">
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

const styles = StyleSheet.create({
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['3'],
  },
  factCell: {
    gap: space['1'],
    minWidth: 120,
    flexGrow: 1,
    flexBasis: '40%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  labelText: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  whereValue: {
    minHeight: 44,
    justifyContent: 'center',
  },
  wherePressed: {
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
});
