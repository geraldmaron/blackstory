/**
 * Clustering: two-interaction resolution + the de-redaction privacy invariant
 * (MOB-012, ADR-024 §9/§10).
 */
import type { LngLat } from '@/features/map/mapCamera';
import {
  assertClusterPrecisionSafe,
  clusterFeatures,
  resolveCluster,
  type Cluster,
} from '../clustering';
import { makeFeature } from '../__fixtures__/features';

describe('clusterFeatures', () => {
  it('merges nearby points into a cluster at low zoom and splits them at high zoom', () => {
    const features = [
      makeFeature('p1', [-77.04, 38.9], { label: 'P1' }),
      makeFeature('p2', [-77.5, 39.1], { label: 'P2' }),
    ];
    const low = clusterFeatures(features, 2);
    expect(low.some((n) => n.kind === 'cluster')).toBe(true);

    const high = clusterFeatures(features, 12);
    expect(high.every((n) => n.kind === 'point')).toBe(true);
  });
});

describe('two-interaction resolution', () => {
  it('resolves a multi-city cluster to individual names within two taps', () => {
    const features = [
      makeFeature('dc', [-77.04, 38.9], { label: 'DC place' }),
      makeFeature('ny', [-73.79, 40.72], { label: 'NY place' }),
      makeFeature('tx', [-95.37, 29.76], { label: 'TX place' }),
    ];
    const nodes = clusterFeatures(features, 2);
    const cluster = nodes.find((n): n is Cluster => n.kind === 'cluster');
    expect(cluster).toBeDefined();

    // Interaction 1: tapping the cluster.
    let interactions = 0;
    let currentZoom = 2;
    let pending: Cluster | undefined = cluster;
    const names: string[] = [];

    while (pending && interactions < 2) {
      interactions += 1;
      const res = resolveCluster(pending, currentZoom);
      if (res.kind === 'entities') {
        names.push(...res.members.map((m) => m.label));
        pending = undefined;
      } else {
        currentZoom = res.toZoom;
        const reNodes = clusterFeatures(pending.members, currentZoom);
        // After the zoom, every node is an individual point (names revealed).
        names.push(
          ...reNodes.filter((n) => n.kind === 'point').map((n) => (n as { feature: { label: string } }).feature.label),
        );
        pending = reNodes.find((n): n is Cluster => n.kind === 'cluster');
      }
    }

    expect(interactions).toBeLessThanOrEqual(2);
    expect(names.length).toBeGreaterThan(0);
  });

  it('coincident redacted points resolve to a list in a single tap (never zooms into false precision)', () => {
    const coincident = [
      makeFeature('a', [-95.37, 29.76], { label: 'Same A' }),
      makeFeature('b', [-95.37, 29.76], { label: 'Same B' }),
    ];
    const cluster = clusterFeatures(coincident, 2).find((n): n is Cluster => n.kind === 'cluster')!;
    const res = resolveCluster(cluster, 2);
    expect(res.kind).toBe('entities');
    if (res.kind === 'entities') {
      expect(res.members.map((m) => m.label).sort()).toEqual(['Same A', 'Same B']);
    }
  });
});

describe('privacy invariant — no de-redaction through clustering', () => {
  it('cluster marker is never more precise than its coarsest member', () => {
    const features = [
      makeFeature('a', [-95.37, 29.76], { label: 'A' }),
      makeFeature('b', [-95.41, 29.8], { label: 'B' }),
    ];
    const cluster = clusterFeatures(features, 2).find((n): n is Cluster => n.kind === 'cluster')!;
    const inputById = new Map<string, LngLat>(features.map((f) => [f.id, f.coordinates]));
    expect(() => assertClusterPrecisionSafe(cluster, inputById)).not.toThrow();
    // The marker (averaged) is coarsened back to 2dp, matching input precision.
    expect(String(cluster.marker[0]).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('every clustered member keeps its exact original redacted coordinate', () => {
    const features = [
      makeFeature('a', [-95.37, 29.76], { label: 'A' }),
      makeFeature('b', [-95.41, 29.8], { label: 'B' }),
    ];
    const cluster = clusterFeatures(features, 2).find((n): n is Cluster => n.kind === 'cluster')!;
    for (const member of cluster.members) {
      const original = features.find((f) => f.id === member.id)!;
      expect(member.coordinates).toBe(original.coordinates); // same reference, unaltered
    }
  });

  it('assertClusterPrecisionSafe throws if a member coordinate was tampered with', () => {
    const original = makeFeature('a', [-95.37, 29.76], { label: 'A' });
    const tampered: Cluster = {
      kind: 'cluster',
      id: 'cl:x',
      marker: [-95.37, 29.76],
      count: 1,
      members: [{ ...original, coordinates: [-95.369803, 29.760427] }],
    };
    const inputById = new Map<string, LngLat>([['a', [-95.37, 29.76]]]);
    expect(() => assertClusterPrecisionSafe(tampered, inputById)).toThrow(/altered/);
  });
});
