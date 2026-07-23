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

      <View style={styles.factsList} accessibilityLabel="Record anatomy">
        {facts.map((fact) => (
          <View
            key={fact.key}
            style={styles.factRow}
            testID={`entity-anatomy-fact-${fact.key}`}
          >
            <View style={styles.labelCluster} testID={`entity-anatomy-fact-label-${fact.key}`}>
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
                style={({ pressed }) => [
                  styles.factValue,
                  styles.whereValue,
                  pressed ? styles.wherePressed : null,
                ]}
              >
                <Text variant="editorial" colorRole="accent">
                  {fact.value}
                </Text>
              </Pressable>
            ) : (
              <Text variant="editorial" colorRole="ink" style={styles.factValue}>
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

/** Exported for layout contract tests — inline icon + label + value on one row. */
export const anatomyFactRowStyle = {
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'baseline',
} as const;

/** Fixed label column so values align vertically (matches web grid max-content column). */
export const anatomyFactLabelColumnWidth = 92;

const styles = StyleSheet.create({
  factsList: {
    flexDirection: 'column',
    gap: space['2'],
    minWidth: 0,
  },
  factRow: {
    ...anatomyFactRowStyle,
    gap: space['3'],
    width: '100%',
    minWidth: 0,
  },
  labelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    width: anatomyFactLabelColumnWidth,
    gap: space['2'],
  },
  factValue: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
  labelText: {
    flexShrink: 0,
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
