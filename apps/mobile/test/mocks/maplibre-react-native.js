/**
 * Shared stand-in for `@maplibre/maplibre-react-native` under Jest.
 *
 * The real package ships untransformed TS/ESM native component modules, so any suite that
 * transitively imports MapScreen used to die with "Cannot use import statement outside a module".
 * That was survivable while MapScreen was only reachable from the map suites, which each declare
 * their own `jest.mock` factory. Once the record page embedded a still map plate
 * (record-place-preview), three entity suites inherited the import and broke, so the stub belongs
 * in `moduleNameMapper` beside the reanimated one rather than copy-pasted per file.
 *
 * A suite that needs to assert camera calls still declares its own `jest.mock` factory with spies;
 * an explicit factory takes precedence over this module.
 */
const React = require('react');
const { View } = require('react-native');

function passthrough(testID) {
  return React.forwardRef(function MapLibreStub(props, ref) {
    React.useImperativeHandle(ref, () => ({
      flyTo() {},
      easeTo() {},
      zoomTo() {},
      fitBounds() {},
      setNativeProps() {},
    }));
    return React.createElement(View, { testID, ...props }, props.children);
  });
}

module.exports = {
  Camera: passthrough('maplibre-camera'),
  GeoJSONSource: passthrough('maplibre-source'),
  Layer: passthrough('maplibre-layer'),
  Map: passthrough('maplibre-map'),
  MapView: passthrough('maplibre-map'),
  ShapeSource: passthrough('maplibre-source'),
  SymbolLayer: passthrough('maplibre-layer'),
  CircleLayer: passthrough('maplibre-layer'),
};
