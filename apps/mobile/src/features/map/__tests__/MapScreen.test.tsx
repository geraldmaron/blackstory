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

jest.mock('@maplibre/maplibre-react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
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
    Camera: () => React.createElement(View, { testID: 'maplibre-camera' }),
    GeoJSONSource: ({ children, data }: { children?: unknown; data?: unknown }) =>
      React.createElement(
        View,
        { testID: 'maplibre-geojson-source', accessibilityLabel: typeof data === 'string' ? data : JSON.stringify(data) },
        children as never,
      ),
    Layer: ({ style }: { style?: unknown }) =>
      React.createElement(View, { testID: 'maplibre-layer', accessibilityLabel: JSON.stringify(style) }),
  };
});

// eslint-disable-next-line import/first
import { MapScreen } from '../MapScreen';
import { DEFAULT_MAP_GLYPHS_URL, MAP_LABEL_TEXT_FONT } from '../mapConfig';

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

  it('renders the OpenStreetMap + Protomaps attribution text', async () => {
    const { getByText } = await render(<MapScreen />);
    expect(getByText(/OpenStreetMap contributors/)).toBeTruthy();
    expect(getByText(/Protomaps/)).toBeTruthy();
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
