/**
 * Entity paint + selection hierarchy for the native Explore plate.
 */
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  ENTITY_SELECTED_INNER_LAYER_STYLE,
  ENTITY_SELECTED_LAYER_STYLE,
  ENTITY_SELECTED_RADIUS_OFFSET,
} from '../entity-paint';
import { DIGNITY_PALETTE } from '../dignity-palette';

describe('entity paint hierarchy', () => {
  it('keeps unclustered fills readable on the dark plate without going fully opaque', () => {
    expect(ENTITY_POINT_FILL_OPACITY).toBeGreaterThanOrEqual(0.6);
    expect(ENTITY_POINT_FILL_OPACITY).toBeLessThan(1);
    expect(ENTITY_CLUSTER_OPACITY).toBeGreaterThan(ENTITY_POINT_FILL_OPACITY);
  });

  it('selected outer ring is copper accent with a larger radius offset than the inner paper ring', () => {
    expect(ENTITY_SELECTED_LAYER_STYLE.circleStrokeColor).toBe(DIGNITY_PALETTE.selectedAccent);
    expect(ENTITY_SELECTED_INNER_LAYER_STYLE.circleStrokeColor).toBe(DIGNITY_PALETTE.selected);
    expect(ENTITY_SELECTED_RADIUS_OFFSET).toBeGreaterThan(3);
    expect(JSON.stringify(ENTITY_SELECTED_LAYER_STYLE.circleRadius)).toContain(
      String(ENTITY_SELECTED_RADIUS_OFFSET),
    );
  });
});
