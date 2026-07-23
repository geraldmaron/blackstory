#!/usr/bin/env node
/**
 * Probe a local api-public instance for health + live Postgres map data.
 * Emits one JSON line on stdout: { status, featureCount?, releaseId?, reason? }.
 *
 * status:
 *   healthy      — health ok, active release, map features > 0
 *   stale        — api-public responds but no live catalog (empty map / no release)
 *   wrong_service — something on the port is not api-public
 *   unreachable  — connection failed or health not ok
 */
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '8080' },
    'map-timeout-ms': { type: 'string', default: '90000' },
  },
});

const host = args.host;
const port = args.port;
const mapTimeoutMs = Number.parseInt(args['map-timeout-ms'], 10);
const base = `http://${host}:${port}`;
const clientHeader = { 'X-BlackStory-Client': 'mobile/1.0.0; api=1' };

function timeoutSignal(ms) {
  return AbortSignal.timeout(Number.isFinite(ms) && ms > 0 ? ms : 90_000);
}

async function probe() {
  try {
    const healthRes = await fetch(`${base}/v1/health`, { signal: timeoutSignal(4_000) });
    if (!healthRes.ok) {
      return { status: 'unreachable', reason: `health_http_${healthRes.status}` };
    }
    const health = await healthRes.json();
    if (health?.service !== 'api-public') {
      return {
        status: 'wrong_service',
        reason: 'not_api_public',
        service: typeof health?.service === 'string' ? health.service : undefined,
      };
    }

    const bootstrapRes = await fetch(`${base}/v1/bootstrap`, {
      headers: clientHeader,
      signal: timeoutSignal(8_000),
    });
    if (!bootstrapRes.ok) {
      return { status: 'stale', reason: `bootstrap_http_${bootstrapRes.status}` };
    }
    const bootstrap = await bootstrapRes.json();
    const releaseId = bootstrap?.activeRelease?.releaseId;
    if (typeof releaseId !== 'string' || releaseId.length === 0) {
      return { status: 'stale', reason: 'no_active_release' };
    }

    const mapRes = await fetch(`${base}/v1/map`, {
      headers: clientHeader,
      signal: timeoutSignal(mapTimeoutMs),
    });
    if (!mapRes.ok) {
      return { status: 'stale', reason: `map_http_${mapRes.status}`, releaseId };
    }
    const map = await mapRes.json();
    const featureCount = Array.isArray(map?.features) ? map.features.length : 0;
    if (featureCount === 0) {
      return { status: 'stale', reason: 'empty_map', releaseId, featureCount: 0 };
    }

    return { status: 'healthy', releaseId, featureCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'unreachable', reason: message };
  }
}

const result = await probe();
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.status === 'healthy' ? 0 : 1);
