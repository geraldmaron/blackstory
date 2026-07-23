#!/usr/bin/env node
/**
 * Shared Metro dev-server contract: one host:port, written to .local/metro-endpoint.json.
 * Device clients load bundles from the LAN IP; loopback-only probes miss stale client URLs.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');
export const ENDPOINT_FILE = path.join(REPO_ROOT, '.local', 'metro-endpoint.json');
export const DEFAULT_METRO_PORT = 8081;
export const DEFAULT_SCAN_PORTS = [8081, 8082, 8083];
export const APP_SCHEME = 'blackstory';
export const IOS_BUNDLE_ID = 'app.blackbook.mobile.dev';

export function detectLanIp() {
  for (const iface of ['en0', 'en1', 'en2']) {
    try {
      const ip = execSync(`ipconfig getifaddr ${iface}`, { encoding: 'utf8' }).trim();
      if (ip && ip !== '127.0.0.1') {
        return ip;
      }
    } catch {
      // try next interface
    }
  }
  return '127.0.0.1';
}

export function resolveMetroPort(raw = process.env.METRO_PORT) {
  const port = Number.parseInt(String(raw ?? DEFAULT_METRO_PORT), 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid METRO_PORT: ${raw ?? ''}`);
  }
  return port;
}

export function parseScanPorts(raw = process.env.METRO_SCAN_PORTS) {
  const source = raw ?? DEFAULT_SCAN_PORTS.join(',');
  return source
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function bundleEntryPath() {
  return 'node_modules/expo-router/entry.bundle';
}

export function buildBundleUrl(host, port, platform = 'ios') {
  const params = new URLSearchParams({
    platform,
    dev: 'true',
    minify: 'false',
    modulesOnly: 'false',
    runModule: 'true',
  });
  return `http://${host}:${port}/${bundleEntryPath()}?${params.toString()}`;
}

export function buildPackagerUrl(host, port) {
  return `http://${host}:${port}`;
}

export function buildDevClientDeepLink(packagerUrl, scheme = APP_SCHEME) {
  const params = new URLSearchParams({
    url: packagerUrl,
    disableOnboarding: '1',
  });
  return `${scheme}://expo-development-client/?${params.toString()}`;
}

export function resolveMetroEndpoint(options = {}) {
  const port = resolveMetroPort(options.port ?? process.env.METRO_PORT);
  const loopbackHost = options.loopbackHost ?? process.env.METRO_LOOPBACK_HOST ?? '127.0.0.1';
  const deviceHost =
    options.deviceHost ??
    process.env.METRO_DEVICE_HOST ??
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME ??
    detectLanIp();
  const packagerUrl = buildPackagerUrl(deviceHost, port);
  const bundleUrl = buildBundleUrl(deviceHost, port);
  return {
    contractPort: port,
    loopbackHost,
    deviceHost,
    packagerUrl,
    bundleUrl,
    devClientDeepLink: buildDevClientDeepLink(packagerUrl),
    scanPorts: parseScanPorts(options.scanPorts ?? process.env.METRO_SCAN_PORTS),
    updatedAt: new Date().toISOString(),
  };
}

export function readMetroEndpointFile() {
  if (!fs.existsSync(ENDPOINT_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function writeMetroEndpointFile(endpoint) {
  fs.mkdirSync(path.dirname(ENDPOINT_FILE), { recursive: true });
  fs.writeFileSync(ENDPOINT_FILE, `${JSON.stringify(endpoint, null, 2)}\n`, 'utf8');
  return ENDPOINT_FILE;
}

export function metroEnvExports(endpoint) {
  return {
    METRO_PORT: String(endpoint.contractPort),
    METRO_HOST: endpoint.deviceHost,
    METRO_LOOPBACK_HOST: endpoint.loopbackHost,
    METRO_DEVICE_HOST: endpoint.deviceHost,
    REACT_NATIVE_PACKAGER_HOSTNAME: endpoint.deviceHost,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { parseArgs } = await import('node:util');
  const { values: args } = parseArgs({
    options: {
      write: { type: 'boolean', default: false },
      port: { type: 'string' },
    },
  });
  const endpoint = resolveMetroEndpoint({ ...(args.port ? { port: args.port } : {}) });
  if (args.write) {
    writeMetroEndpointFile(endpoint);
  }
  process.stdout.write(`${JSON.stringify(endpoint)}\n`);
}
