/**
 * Redaction regression at the RENDER layer (MOB-011).
 *
 * The map screen only ever receives the already-redacted, release-coupled GeoJSON
 * that apps/api-public serves (see demoMapSource.ts provenance). This test proves
 * the render layer is a faithful, non-amplifying consumer: it renders exactly the
 * coarsened coordinates it is given and never re-introduces or reveals a more
 * precise value. The raw pre-redaction coordinate of the critical living-person
 * fixture is used as a NEGATIVE CONTROL and asserted absent from everything the
 * native GeoJSON source receives.
 *
 * The authoritative raw -> redacted guarantee lives upstream in
 * packages/domain/src/map/map-source.redaction.test.ts (wired to the REAL
 * @repo/security redactor) and is neither weakened nor bypassed here.
 */
import { render } from '@testing-library/react-native';

jest.mock('@maplibre/maplibre-react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: ({ children }: { children?: unknown }) => React.createElement(View, { testID: 'maplibre-map' }, children as never),
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
// eslint-disable-next-line import/first
import { DEMO_MAP_SOURCE, RAW_LIVING_PERSON } from '../demoMapSource';

async function renderedSourceJson(): Promise<string> {
  const { getByTestId } = await render(<MapScreen source={DEMO_MAP_SOURCE} />);
  // The mock forwards the GeoJSON `data` prop verbatim as accessibilityLabel.
  return String(getByTestId('maplibre-geojson-source').props.accessibilityLabel);
}

describe('MapScreen redaction regression', () => {
  it('never passes the raw living-person residential coordinate to the native map source', async () => {
    const serialized = await renderedSourceJson();
    expect(serialized).not.toContain(String(RAW_LIVING_PERSON.lat)); // 29.760427
    expect(serialized).not.toContain(String(RAW_LIVING_PERSON.lng)); // -95.369803
    expect(serialized).not.toContain(RAW_LIVING_PERSON.streetLabelFragment); // 'Bayou Street'
  });

  it('renders the entity ONLY at the coarsened city-precision coordinate it was given', async () => {
    const serialized = await renderedSourceJson();
    // The coarsened value IS present (entity is not silently dropped)...
    expect(serialized).toContain('29.76');
    expect(serialized).toContain('-95.37');
    // ...and it is the exact source data, unmodified by the render layer.
    expect(serialized).toBe(JSON.stringify(DEMO_MAP_SOURCE));
    const living = DEMO_MAP_SOURCE.features.find(
      (f) => f.id === 'ent_fixture_person_living_houston_tx',
    );
    expect(living?.properties.precision).toBe('city');
  });

  it('carries no raw address-shaped label or residential precision in any feature property', () => {
    for (const feature of DEMO_MAP_SOURCE.features) {
      const props = JSON.stringify(feature.properties);
      expect(props).not.toContain(RAW_LIVING_PERSON.streetLabelFragment);
      expect(['street_address', 'exact_coordinates', 'residence', 'parcel', 'unit']).not.toContain(
        feature.properties.precision,
      );
    }
  });
});
