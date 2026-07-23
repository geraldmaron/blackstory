/**
 * Unit tests for cluster expand zoom helpers (MapScreen cluster-press path).
 */
import {
  CLUSTER_CAMERA_ZOOM_STEP,
  clusterCenterFromFeature,
  isClusterFeatureProperties,
  zoomAfterClusterExpand,
} from '../clusterCamera';
import { MAP_MAX_ZOOM } from '../mapCamera';

describe('isClusterFeatureProperties', () => {
  it('treats point_count / cluster=true as clusters', () => {
    expect(isClusterFeatureProperties({ point_count: 12 })).toBe(true);
    expect(isClusterFeatureProperties({ cluster: true })).toBe(true);
  });

  it('does not treat leaf entity points as clusters', () => {
    expect(isClusterFeatureProperties({ entityId: 'ent_1' })).toBe(false);
    expect(isClusterFeatureProperties({})).toBe(false);
  });
});

describe('clusterCenterFromFeature', () => {
  it('reads Point coordinates', () => {
    expect(
      clusterCenterFromFeature({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-95.37, 29.76] },
        properties: { point_count: 3 },
      }),
    ).toEqual([-95.37, 29.76]);
  });

  it('returns null for non-Point geometry', () => {
    expect(
      clusterCenterFromFeature({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: {},
      }),
    ).toBeNull();
  });
});

describe('zoomAfterClusterExpand', () => {
  it(`advances by ${CLUSTER_CAMERA_ZOOM_STEP} and clamps to MAP_MAX_ZOOM`, () => {
    expect(zoomAfterClusterExpand(4)).toBe(4 + CLUSTER_CAMERA_ZOOM_STEP);
    expect(zoomAfterClusterExpand(MAP_MAX_ZOOM)).toBe(MAP_MAX_ZOOM);
    expect(zoomAfterClusterExpand(MAP_MAX_ZOOM - 1)).toBe(MAP_MAX_ZOOM);
    expect(zoomAfterClusterExpand(Number.NaN)).toBe(CLUSTER_CAMERA_ZOOM_STEP);
  });
});
