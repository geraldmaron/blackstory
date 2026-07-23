/**
 * Visit hand-off block on entity detail: open the device maps app at the record's public
 * `geoAnchor` (never finer), show an honest precision label, and return to Explore with the
 * same entity selected (`/explore?selected=<id>`).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, LiftedSurface, Notice, Text, space } from '@/ui';
import { SECTION_HEADINGS } from '../copy';
import { humanizeToken } from '../format';
import { openMapsAtPublicAnchor } from '../maps-handoff';
import type { Entity } from '../types';
import { SectionHeading } from './SectionHeading';

export type VisitSectionProps = {
  readonly entity: Entity;
  readonly onBackToMap?: () => void;
};

function precisionCaption(entity: Entity): string {
  const place = entity.locationLabel.trim() || entity.jurisdictionLabel.trim() || 'This record';
  if (entity.locationPrecision) {
    return `${place} (${entity.locationPrecision} precision)`;
  }
  return place;
}

export function VisitSection({ entity, onBackToMap }: VisitSectionProps) {
  const [mapsError, setMapsError] = useState<string | undefined>(undefined);
  const anchor = entity.geoAnchor;
  const hasPublicAnchor =
    anchor !== undefined && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng);

  async function handleOpenInMaps() {
    if (!hasPublicAnchor || !anchor) {
      setMapsError('No public coordinates are available for this record yet.');
      return;
    }
    setMapsError(undefined);
    const result = await openMapsAtPublicAnchor(anchor.lat, anchor.lng);
    if (result !== 'opened') {
      setMapsError('Could not open Maps. Try again, or use Back to map inside BlackStory.');
    }
  }

  return (
    <View style={styles.container} testID="entity-visit-section">
      <SectionHeading level={2}>{SECTION_HEADINGS.visit}</SectionHeading>
      <LiftedSurface tone="surface" shadow="none" paddingKey="3" contentStyle={styles.body}>
        <Text variant="bodySmall" colorRole="inkMuted">
          {hasPublicAnchor
            ? `Location shown at public precision only. ${precisionCaption(entity)}.`
            : 'No public coordinates for this record yet. Exact residential addresses are never shown.'}
        </Text>
        {entity.locationPrecision ? (
          <Text variant="code" colorRole="inkMuted">
            Location precision: {humanizeToken(entity.locationPrecision)}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {hasPublicAnchor ? (
            <Button
              label="Open in Maps"
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
              label="Back to map"
              variant="secondary"
              density="compact"
              accessibilityLabel={`Back to map with ${entity.displayName} selected`}
              onPress={onBackToMap}
            />
          ) : null}
        </View>

        {mapsError ? <Notice tone="info" title="Maps unavailable" description={mapsError} /> : null}
      </LiftedSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space['2'],
  },
  body: {
    gap: space['2'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
});
