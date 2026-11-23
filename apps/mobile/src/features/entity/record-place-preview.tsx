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
import { ExhibitFrame, Receipt, Text } from '@/ui';
import { MapScreen, type MapCameraCommand, type MapFeatureCollection } from '@/features/map';
import type { RecordAnatomyPlace } from './entity-anatomy-facts';

export type RecordPlacePreviewProps = {
  readonly place?: RecordAnatomyPlace;
  /** A harm-adjacent record: no crop marks. */
  readonly quiet?: boolean;
  readonly onOpenInMaps?: () => void;
};

const PREVIEW_HEIGHT = 168;
/**
 * Locator framing. MapScreen clamps every camera move to MAP_MAX_ZOOM, so this cannot show a
 * precision the redacted release artifact does not already publish.
 */
const LOCATOR_ZOOM = 11;

export function RecordPlacePreview({
  place,
  quiet = false,
  onOpenInMaps,
}: RecordPlacePreviewProps) {
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
      <Text
        variant="bodySmall"
        colorRole="inkMuted"
        accessibilityLabel="Place not pinned on the archive map"
        testID="record-place-empty"
      >
        Place not pinned
      </Text>
    );
  }

  const label = `Map showing ${place.label} at public precision`;
  const map = (
    <View
      style={styles.frame}
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

  // The map is drawn no sharper than the stored precision, and the label says which that is.
  // Only the map is the button: wrapping the whole exhibit would hide its label from VoiceOver.
  return (
    <ExhibitFrame
      kind="map"
      ground="ink"
      basis={`${place.precision ?? 'city'} precision`}
      variant={quiet ? 'quiet' : 'full'}
      receipt={<Receipt source={place.label} />}
      testID="record-place-exhibit"
    >
      {onOpenInMaps ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.label} in Maps at public precision`}
          onPress={onOpenInMaps}
          testID="record-place-preview-pressable"
        >
          {map}
        </Pressable>
      ) : (
        map
      )}
    </ExhibitFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: PREVIEW_HEIGHT,
    overflow: 'hidden',
  },
});
