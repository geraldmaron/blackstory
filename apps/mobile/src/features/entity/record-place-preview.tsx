/**
 * Place locator for record anatomy on mobile.
 *
 * This renders the real map surface as a STILL PLATE: `gesturesEnabled={false}`, which is the
 * case MapScreen's own prop doc reserves for "a printed-frame preview". No gestures, no zoom
 * controls, one pin, camera parked on the point. Pressing it hands off to the OS maps app, which
 * is where panning and zooming belong for a single address.
 *
 * A hand-drawn stand-in — a dot, a stem and the place name on an empty surface, captioned "Map
 * preview" — is not the same affordance: nothing about it is a map, so section 01 reads as a map
 * that has failed to load.
 *
 * Attribution stays on (MapScreen's default): it is a licensing obligation of the tiles, not
 * chrome we may drop because the frame is small.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, Text, space, useThemeColors } from '@/ui';
import { MapScreen, type MapCameraCommand, type MapFeatureCollection } from '@/features/map';
import type { RecordAnatomyPlace } from './entity-anatomy-facts';

export type RecordPlacePreviewProps = {
  readonly place?: RecordAnatomyPlace;
  readonly onOpenInMaps?: () => void;
};

const PREVIEW_HEIGHT = 168;
/**
 * Locator framing. MapScreen clamps every camera move to MAP_MAX_ZOOM, so this cannot show a
 * precision the redacted release artifact does not already publish.
 */
const LOCATOR_ZOOM = 11;

export function RecordPlacePreview({ place, onOpenInMaps }: RecordPlacePreviewProps) {
  const theme = useThemeColors();

  const source = useMemo<MapFeatureCollection | undefined>(() => {
    if (!place) return undefined;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'record-place',
          geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
          properties: {
            entityId: 'record-place',
            kind: 'place',
            displayName: place.label,
            precision: place.precision ?? 'city',
          },
        },
      ],
    };
  }, [place]);

  const camera = useMemo<MapCameraCommand | undefined>(
    () =>
      place
        ? { kind: 'center', center: [place.lng, place.lat], zoom: LOCATOR_ZOOM, token: 1 }
        : undefined,
    [place],
  );

  if (!place || !source || !camera) {
    return (
      <View
        style={[
          styles.frame,
          styles.empty,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        accessibilityRole="image"
        accessibilityLabel="Place not pinned on the archive map"
        testID="record-place-empty"
      >
        <Text variant="code" colorRole="inkMuted">
          Place not pinned
        </Text>
      </View>
    );
  }

  const label = `Map showing ${place.label} at public precision`;
  const plate = (
    <View
      style={[styles.frame, { borderColor: theme.border }]}
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="record-place-preview"
    >
      <MapScreen
        source={source}
        cameraCommand={camera}
        gesturesEnabled={false}
        clustering={false}
        selectedEntityId="record-place"
      />
    </View>
  );

  if (onOpenInMaps) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.label} in Maps at public precision`}
        onPress={onOpenInMaps}
        testID="record-place-preview-pressable"
      >
        {plate}
      </Pressable>
    );
  }

  return plate;
}

const styles = StyleSheet.create({
  frame: {
    height: PREVIEW_HEIGHT,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    // The map paints to its own edges; without this the plate's corners square off over the radius.
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['3'],
  },
});
