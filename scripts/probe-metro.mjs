#!/usr/bin/env node
/**
 * Probe Expo/Metro using the repo's single metro-endpoint contract.
 * Verifies bundle HTTP 200 on the LAN/device host (not loopback-only) and fails when
 * a booted iOS Simulator dev client still targets a stale sibling port.
 */
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import {
  ENDPOINT_FILE,
  buildBundleUrl,
  readMetroEndpointFile,
  resolveMetroEndpoint,
  writeMetroEndpointFile,
} from './metro-endpoint.mjs';
import { iosClientMatchesEndpoint, readIosDevClientTarget } from './ios-dev-client-target.mjs';

const { values: args } = parseArgs({
  options: {
    host: { type: 'string' },
    port: { type: 'string' },
    'bundle-platform': { type: 'string', default: 'ios' },
    'bundle-entry': { type: 'string', default: 'node_modules/expo-router/entry.bundle' },
    'status-timeout-ms': { type: 'string', default: '4000' },
    'bundle-timeout-ms': { type: 'string', default: '120000' },
    'scan-ports': { type: 'string' },
    'skip-client-check': { type: 'boolean', default: false },
    'write-endpoint': { type: 'boolean', default: false },
  },
});

const endpoint =
  readMetroEndpointFile() ??
  resolveMetroEndpoint({
    ...(args.port ? { port: args.port } : {}),
    ...(args['scan-ports'] ? { scanPorts: args['scan-ports'] } : {}),
  });

const deviceHost = args.host ?? endpoint.deviceHost;
const contractPort = String(args.port ?? endpoint.contractPort);
const scanPorts = (args['scan-ports'] ?? endpoint.scanPorts.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const bundlePlatform = args['bundle-platform'];
const bundleEntry = args['bundle-entry'].replace(/^\//, '');
const statusTimeoutMs = Number.parseInt(args['status-timeout-ms'], 10);
const bundleTimeoutMs = Number.parseInt(args['bundle-timeout-ms'], 10);

function timeoutSignal(ms) {
  return AbortSignal.timeout(Number.isFinite(ms) && ms > 0 ? ms : 4_000);
}

function bundleUrlFor(base) {
  const params = new URLSearchParams({
    platform: bundlePlatform,
    dev: 'true',
    minify: 'false',
    modulesOnly: 'false',
    runModule: 'true',
  });
  return `${base}/${bundleEntry}?${params.toString()}`;
}

async function readPackagerStatus(base) {
  const statusRes = await fetch(`${base}/status`, { signal: timeoutSignal(statusTimeoutMs) });
  if (!statusRes.ok) {
    return { ok: false, reason: `status_http_${statusRes.status}` };
  }
  const body = (await statusRes.text()).trim();
  if (body === 'packager-status:running') {
    return { ok: true, packagerStatus: body };
  }
  return {
    ok: false,
    reason: 'not_metro_packager',
    packagerStatus: body.slice(0, 120) || undefined,
  };
}

async function probeBundle(base) {
  const bundleUrl = bundleUrlFor(base);
  const bundleRes = await fetch(bundleUrl, {
    method: 'GET',
    signal: timeoutSignal(bundleTimeoutMs),
    headers: { Accept: 'application/javascript' },
  });
  return { bundleUrl, bundleHttpStatus: bundleRes.status, bundleOk: bundleRes.ok };
}

async function probePort(probeHost, probePort) {
  const base = `http://${probeHost}:${probePort}`;
  try {
    const status = await readPackagerStatus(base);
    if (!status.ok) {
      if (status.reason === 'not_metro_packager') {
        return {
          status: 'wrong_service',
          host: probeHost,
          port: probePort,
          reason: status.reason,
          ...(status.packagerStatus ? { packagerStatus: status.packagerStatus } : {}),
        };
      }
      return {
        status: 'unreachable',
        host: probeHost,
        port: probePort,
        reason: status.reason ?? 'status_not_ok',
      };
    }

    const bundle = await probeBundle(base);
    if (!bundle.bundleOk) {
      return {
        status: 'running_no_bundle',
        host: probeHost,
        port: probePort,
        packagerStatus: status.packagerStatus,
        bundleUrl: bundle.bundleUrl,
        bundleHttpStatus: bundle.bundleHttpStatus,
        reason: `bundle_http_${bundle.bundleHttpStatus}`,
      };
    }

    return {
      status: 'healthy',
      host: probeHost,
      port: probePort,
      packagerStatus: status.packagerStatus,
      bundleUrl: bundle.bundleUrl,
      bundleHttpStatus: bundle.bundleHttpStatus,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'unreachable', host: probeHost, port: probePort, reason: message };
  }
}

async function scanDuplicateHealthyPorts(probeHost, expectedPort) {
  const duplicatePorts = [];
  for (const scanPort of scanPorts) {
    if (scanPort === expectedPort) {
      continue;
    }
    const result = await probePort(probeHost, scanPort);
    if (result.status === 'healthy' || result.status === 'running_no_bundle') {
      duplicatePorts.push(scanPort);
    }
  }
  return duplicatePorts;
}

async function detectStaleClientPort(probeHost, expectedPort) {
  const stalePorts = [];
  for (const scanPort of scanPorts) {
    if (scanPort === expectedPort) {
      continue;
    }
    const result = await probePort(probeHost, scanPort);
    if (result.status === 'unreachable' || result.status === 'wrong_service') {
      stalePorts.push(scanPort);
    }
  }
  return stalePorts;
}

const contract = await probePort(deviceHost, contractPort);
const result = {
  ...contract,
  contractPort: Number.parseInt(contractPort, 10),
  deviceHost,
  loopbackHost: endpoint.loopbackHost,
  packagerUrl: `http://${deviceHost}:${contractPort}`,
  deviceMustLoadUrl: buildBundleUrl(deviceHost, contractPort, bundlePlatform),
  endpointFile: ENDPOINT_FILE,
};

if (contract.status === 'healthy' || contract.status === 'running_no_bundle') {
  const duplicatePorts = await scanDuplicateHealthyPorts(deviceHost, contractPort);
  if (duplicatePorts.length > 0) {
    result.duplicatePorts = duplicatePorts;
    result.reason = `duplicate_metro_ports:${duplicatePorts.join(',')}`;
    if (result.status === 'healthy') {
      result.status = 'running_no_bundle';
    }
  }
}

if (!args['skip-client-check']) {
  const clientTarget = readIosDevClientTarget();
  result.clientTarget = clientTarget.available
    ? {
        targetUrl: clientTarget.targetUrl,
        targetHost: clientTarget.targetHost,
        targetPort: clientTarget.targetPort,
      }
    : { available: false, reason: clientTarget.reason };

  const endpointForMatch = {
    contractPort: Number.parseInt(contractPort, 10),
    deviceHost,
  };

  if (clientTarget.available && !iosClientMatchesEndpoint(clientTarget, endpointForMatch)) {
    result.status = 'stale_client_port';
    result.reason = `ios_dev_client_targets_${clientTarget.targetHost}:${clientTarget.targetPort}_expected_${deviceHost}:${contractPort}`;
    result.clientResetCommand = 'bash scripts/reset-ios-dev-client.sh';
  } else if (result.status === 'healthy') {
    const deadSiblingPorts = await detectStaleClientPort(deviceHost, contractPort);
    if (deadSiblingPorts.length > 0) {
      result.deadSiblingPorts = deadSiblingPorts;
    }
  }
}

if (args['write-endpoint'] && result.status === 'healthy') {
  writeMetroEndpointFile({
    ...resolveMetroEndpoint({ port: contractPort, deviceHost }),
    deviceMustLoadUrl: result.deviceMustLoadUrl,
    bundleUrl: result.bundleUrl,
    bundleHttpStatus: result.bundleHttpStatus,
  });
  result.endpointWritten = ENDPOINT_FILE;
}

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.status === 'healthy' ? 0 : 1);
