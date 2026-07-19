/**
 * Explore feature projection + label sanitization (MOB-012).
 * Covers the "malicious/oversized labels" adversarial case and the
 * coordinate-passthrough (no de-redaction) guarantee.
 */
import { DEMO_MAP_SOURCE } from '@/features/map/demoMapSource';
import {
  MAX_LABEL_LENGTH,
  sanitizeLabel,
  toExploreFeatures,
  toExploreFeature,
} from '../explore-feature';

describe('sanitizeLabel', () => {
  it('returns a non-empty fallback for non-strings and empty input', () => {
    expect(sanitizeLabel(undefined)).toBe('Untitled record');
    expect(sanitizeLabel(null)).toBe('Untitled record');
    expect(sanitizeLabel(12345 as unknown)).toBe('Untitled record');
    expect(sanitizeLabel('   ')).toBe('Untitled record');
  });

  it('truncates a pathological megabyte-long label without hanging or crashing', () => {
    const hostile = 'A'.repeat(1_000_000);
    const start = Date.now();
    const out = sanitizeLabel(hostile);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(out.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
    expect(out.endsWith('…')).toBe(true); // ellipsis
  });

  it('strips control chars and Unicode bidi-override / zero-width spoofing chars', () => {
    const spoofed = `Safe‮EVIL​  Name\n\t`;
    const out = sanitizeLabel(spoofed);
    expect(out).not.toContain('‮'); // RTL override
    expect(out).not.toContain('​'); // zero-width space
    expect(out).not.toContain('\n');
    expect(out).not.toContain('\t');
    expect(out).toContain('Safe');
    expect(out).toContain('Name');
  });
});

describe('toExploreFeature — coordinate passthrough (no de-redaction)', () => {
  it('passes the redacted coordinate through byte-for-byte', () => {
    for (const feature of DEMO_MAP_SOURCE.features) {
      const projected = toExploreFeature(feature);
      expect(projected.coordinates[0]).toBe(feature.geometry.coordinates[0]);
      expect(projected.coordinates[1]).toBe(feature.geometry.coordinates[1]);
    }
  });

  it('never adds decimal precision to any coordinate', () => {
    const projected = toExploreFeatures(DEMO_MAP_SOURCE);
    for (let i = 0; i < projected.length; i += 1) {
      const src = DEMO_MAP_SOURCE.features[i].geometry.coordinates;
      expect(String(projected[i].coordinates[0])).toBe(String(src[0]));
      expect(String(projected[i].coordinates[1])).toBe(String(src[1]));
    }
  });
});
