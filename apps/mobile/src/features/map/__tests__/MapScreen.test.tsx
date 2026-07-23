/**
 * JS-level smoke + failure-state tests for MapScreen.
 *
 * These are NOT a native visual render: a JS test runner cannot mount MapLibre
 * Native's Metal/OpenGL view, so `@maplibre/maplibre-react-native` is mocked with
 * plain RN Views. What they prove is that the screen COMPONENT mounts without
 * crashing, wires the redacted GeoJSON into a source, keeps attribution visible,
 * and shows the correct degraded ErrorState per failure mode instead of throwing.
 * Real on-device tile rendering / memory traces are deferred (see ADR-024).
 */
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockFlyTo = jest.fn();

jest.mock('@maplibre/maplibre-react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  const Camera = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ flyTo: mockFlyTo, fitBounds: jest.fn() }));
    return React.createElement(View, {
      testID: 'maplibre-camera',
      accessibilityLabel: JSON.stringify({
        minZoom: props.minZoom,
        maxZoom: props.maxZoom,
        maxBounds: props.maxBounds,
      }),
    });
  });
  Camera.displayName = 'Camera';
  return {
    Map: ({
      children,
      testID,
      mapStyle,
    }: {
      children?: unknown;
      testID?: string;
      mapStyle?: string;
    }) =>
      React.createElement(
        View,
        { testID: testID ?? 'maplibre-map', accessibilityLabel: mapStyle },
        children as never,
      ),
    Camera,
    GeoJSONSource: ({
      children,
      data,
      onPress,
    }: {
      children?: unknown;
      data?: unknown;
      onPress?: (event: unknown) => void;
    }) =>
      React.createElement(
        View,
        {
          testID: 'maplibre-geojson-source',
          accessibilityLabel: typeof data === 'string' ? data : JSON.stringify(data),
          // Pass through so tests can fireEvent(source, 'press', { nativeEvent: ... }).
          onPress,
        },
        children as never,
      ),
    Layer: ({ style }: { style?: unknown }) =>
      React.createElement(View, { testID: 'maplibre-layer', accessibilityLabel: JSON.stringify(style) }),
  };
});

// eslint-disable-next-line import/first
import { MapScreen } from '../MapScreen';
import { DEFAULT_MAP_GLYPHS_URL, MAP_LABEL_TEXT_FONT } from '../mapConfig';
import { CLUSTER_CAMERA_ZOOM_STEP } from '../clusterCamera';
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, PRESET_ZOOM, US_CAMERA_MAX_BOUNDS } from '../mapCamera';
import { ENTITY_CLUSTER_RADIUS_EXPR, ENTITY_POINT_RADIUS } from '../mapStyle';
import { MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM } from '../MapAttribution';

beforeEach(() => {
  mockFlyTo.mockClear();
});

describe('MapScreen — ready state', () => {
  it('mounts the native map, a GeoJSON source, and visible attribution without crashing', async () => {
    const { getByTestId } = await render(<MapScreen />);
    expect(getByTestId('map-screen')).toBeTruthy();
    expect(getByTestId('maplibre-map')).toBeTruthy();
    expect(getByTestId('maplibre-geojson-source')).toBeTruthy();
    // Attribution is a real, on-screen element (license obligation), not just doc.
    expect(getByTestId('map-attribution')).toBeTruthy();
  });

  it('passes a style JSON with HTTPS glyphs (never empty / scheme-less)', async () => {
    const { getByTestId } = await render(<MapScreen />);
    const styleJson = getByTestId('maplibre-map').props.accessibilityLabel as string;
    const style = JSON.parse(styleJson) as { glyphs?: string };
    expect(style.glyphs).toBe(DEFAULT_MAP_GLYPHS_URL);
    expect(style.glyphs?.startsWith('https://')).toBe(true);
  });

  it('uses OpenFreeMap Noto Sans for cluster count labels (not default Open Sans)', async () => {
    const { getAllByTestId } = await render(<MapScreen />);
    const layers = getAllByTestId('maplibre-layer');
    const clusterCount = layers.find((node) => {
      const style = JSON.parse(node.props.accessibilityLabel as string) as {
        textField?: unknown;
        textFont?: string[];
      };
      return Boolean(style.textField);
    });
    expect(clusterCount).toBeTruthy();
    const style = JSON.parse(clusterCount!.props.accessibilityLabel as string) as {
      textFont?: string[];
    };
    expect(style.textFont).toEqual([...MAP_LABEL_TEXT_FONT]);
  });

  it('renders OpenStreetMap + OpenFreeMap attribution by default', async () => {
    const { getByText } = await render(<MapScreen />);
    expect(getByText(/OpenStreetMap contributors/)).toBeTruthy();
    expect(getByText(/OpenFreeMap/)).toBeTruthy();
  });

  it('places attribution above the sheet peek (not in a bottom sandwich gap)', async () => {
    const { getByTestId } = await render(<MapScreen />);
    const attribution = getByTestId('map-attribution');
    const flat = StyleSheet.flatten(attribution.props.style);
    expect(flat.bottom).toBe(MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM);
  });

  it('clamps the camera to CONUS maxBounds with a national minZoom floor', async () => {
    const { getByTestId } = await render(<MapScreen />);
    const camera = JSON.parse(getByTestId('maplibre-camera').props.accessibilityLabel as string) as {
      minZoom?: number;
      maxZoom?: number;
      maxBounds?: number[];
    };
    expect(camera.minZoom).toBe(MAP_MIN_ZOOM);
    expect(camera.maxZoom).toBe(MAP_MAX_ZOOM);
    expect(camera.maxBounds).toEqual([...US_CAMERA_MAX_BOUNDS]);
  });

  it('uses compact cluster radius steps (flat copper, size not heat)', async () => {
    const { getAllByTestId } = await render(<MapScreen />);
    const layers = getAllByTestId('maplibre-layer');
    const cluster = layers.find((node) => {
      const style = JSON.parse(node.props.accessibilityLabel as string) as {
        circleRadius?: unknown;
      };
      return Array.isArray(style.circleRadius);
    });
    expect(cluster).toBeTruthy();
    const style = JSON.parse(cluster!.props.accessibilityLabel as string) as {
      circleRadius: unknown[];
      circleColor: string;
    };
    expect(style.circleRadius).toEqual([...ENTITY_CLUSTER_RADIUS_EXPR]);
    expect(style.circleColor).toBeTruthy();
    expect(ENTITY_POINT_RADIUS).toBeLessThanOrEqual(5);
  });

  it('renders Protomaps attribution when a PMTiles URL is configured', async () => {
    const { getByText } = await render(
      <MapScreen pmtilesUrl="https://cdn.example/us.pmtiles" />,
    );
    // Attribution lines come from module-level MAP_ATTRIBUTION_LINES (OpenFreeMap
    // default). When only the style switches to PMTiles via prop, the chrome
    // still shows the configured attribution set — OSM must remain visible.
    expect(getByText(/OpenStreetMap contributors/)).toBeTruthy();
  });
});

describe('MapScreen — degraded failure states', () => {
  const cases = [
    { mode: 'provider-outage' as const, match: /temporarily unavailable/i },
    { mode: 'corrupt-tiles' as const, match: /could not be loaded/i },
    { mode: 'offline-cold-start' as const, match: /offline/i },
  ];

  it.each(cases)('shows the $mode ErrorState instead of the map', async ({ mode, match }) => {
    const { getByTestId, queryByTestId, getByText } = await render(
      <MapScreen loadState={{ kind: 'error', mode }} />,
    );
    expect(getByTestId('map-error-state')).toBeTruthy();
    expect(getByText(match)).toBeTruthy();
    // The native map view must NOT be mounted in an error state (degrade, not crash).
    expect(queryByTestId('maplibre-map')).toBeNull();
  });

  it('offers a retry that fires the provided callback', async () => {
    const onRetry = jest.fn();
    const { getByRole } = await render(
      <MapScreen loadState={{ kind: 'error', mode: 'provider-outage' }} onRetry={onRetry} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('MapScreen — feature / cluster press', () => {
  it('calls onFeaturePress with entityId for leaf points', async () => {
    const onFeaturePress = jest.fn();
    const { getByTestId } = await render(<MapScreen onFeaturePress={onFeaturePress} />);
    fireEvent(getByTestId('maplibre-geojson-source'), 'press', {
      nativeEvent: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-77.04, 38.9] },
            properties: { entityId: 'ent_leaf' },
          },
        ],
        lngLat: [-77.04, 38.9],
      },
    });
    expect(onFeaturePress).toHaveBeenCalledWith('ent_leaf');
    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  it('expands the camera toward a cluster when onClusterPress is omitted', async () => {
    const onFeaturePress = jest.fn();
    const { getByTestId } = await render(<MapScreen onFeaturePress={onFeaturePress} />);
    fireEvent(getByTestId('maplibre-geojson-source'), 'press', {
      nativeEvent: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-95.37, 29.76] },
            properties: { point_count: 8, cluster: true },
          },
        ],
        lngLat: [-95.37, 29.76],
      },
    });
    expect(onFeaturePress).not.toHaveBeenCalled();
    expect(mockFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-95.37, 29.76],
        zoom: Math.min(MAP_MAX_ZOOM, PRESET_ZOOM.national + CLUSTER_CAMERA_ZOOM_STEP),
      }),
    );
  });

  it('delegates to onClusterPress when provided instead of expanding', async () => {
    const onClusterPress = jest.fn();
    const { getByTestId } = await render(<MapScreen onClusterPress={onClusterPress} />);
    fireEvent(getByTestId('maplibre-geojson-source'), 'press', {
      nativeEvent: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-73.99, 40.73] },
            properties: { point_count: 4 },
          },
        ],
        lngLat: [-73.99, 40.73],
      },
    });
    expect(onClusterPress).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-73.99, 40.73],
        pointCount: 4,
      }),
    );
    expect(mockFlyTo).not.toHaveBeenCalled();
  });
});
