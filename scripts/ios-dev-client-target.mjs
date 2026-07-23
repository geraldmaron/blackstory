#!/usr/bin/env node
/**
 * Read or reset the Expo dev client's persisted packager URL on a booted iOS Simulator.
 * The dev launcher stores recently opened servers in UserDefaults under
 * expo.devlauncher.recentlyopenedapps; the newest entry wins on cold launch.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_SCHEME,
  IOS_BUNDLE_ID,
  buildDevClientDeepLink,
  buildPackagerUrl,
  resolveMetroEndpoint,
} from './metro-endpoint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function bootedSimulatorUdid() {
  const result = run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
  if (result.status !== 0) {
    return null;
  }
  const payload = JSON.parse(result.stdout || '{}');
  for (const runtimeDevices of Object.values(payload.devices ?? {})) {
    for (const device of runtimeDevices) {
      if (device.state === 'Booted') {
        return device.udid;
      }
    }
  }
  return null;
}

function simulatorAppInfo(bundleId = IOS_BUNDLE_ID) {
  const udid = bootedSimulatorUdid();
  if (!udid) {
    return null;
  }

  // simctl listapps -j is not valid JSON on current Xcode; parse the text table instead.
  const result = run('xcrun', ['simctl', 'listapps', 'booted']);
  if (result.status !== 0) {
    return null;
  }
  const block = new RegExp(
    `"${bundleId.replace(/\./g, '\\.')}"\\s*=\\s*\\{[\\s\\S]*?DataContainer\\s*=\\s*"file://([^"]+)"`,
  ).exec(result.stdout ?? '');
  if (!block) {
    return null;
  }
  const dataContainer = block[1];
  const plistPath = path.join(dataContainer, 'Library', 'Preferences', `${bundleId}.plist`);
  return {
    bundleId,
    dataContainer,
    plistPath,
    simulatorUdid: udid,
  };
}

function readPlistJson(plistPath) {
  if (!fs.existsSync(plistPath)) {
    return {};
  }
  const result = run('plutil', ['-convert', 'json', '-o', '-', plistPath]);
  if (result.status !== 0) {
    throw new Error(result.stderr || `plutil failed for ${plistPath}`);
  }
  return JSON.parse(result.stdout || '{}');
}

function writePlistJson(plistPath, data) {
  const tmpJson = path.join(os.tmpdir(), `metro-client-${process.pid}.json`);
  fs.writeFileSync(tmpJson, JSON.stringify(data));
  const result = run('plutil', ['-convert', 'binary1', '-o', plistPath, tmpJson]);
  fs.rmSync(tmpJson, { force: true });
  if (result.status !== 0) {
    throw new Error(result.stderr || `plutil write failed for ${plistPath}`);
  }
}

function parsePackagerTarget(url) {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    return {
      targetUrl: url,
      targetHost: parsed.hostname,
      targetPort: port,
    };
  } catch {
    return null;
  }
}

export function readIosDevClientTarget(options = {}) {
  const bundleId = options.bundleId ?? IOS_BUNDLE_ID;
  if (process.platform !== 'darwin') {
    return { available: false, reason: 'not_macos' };
  }
  if (!bootedSimulatorUdid()) {
    return { available: false, reason: 'no_booted_simulator' };
  }
  const appInfo = simulatorAppInfo(bundleId);
  if (!appInfo) {
    return { available: false, reason: 'app_not_installed', bundleId };
  }
  const plist = readPlistJson(appInfo.plistPath);
  const registry = plist['expo.devlauncher.recentlyopenedapps'];
  if (!registry || typeof registry !== 'object') {
    return {
      available: true,
      bundleId,
      plistPath: appInfo.plistPath,
      targetUrl: null,
      targetHost: null,
      targetPort: null,
    };
  }
  let newest = null;
  for (const entry of Object.values(registry)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const url = typeof entry.url === 'string' ? entry.url : null;
    const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : 0;
    if (!url) {
      continue;
    }
    if (!newest || timestamp > newest.timestamp) {
      newest = { url, timestamp };
    }
  }
  if (!newest) {
    return {
      available: true,
      bundleId,
      plistPath: appInfo.plistPath,
      targetUrl: null,
      targetHost: null,
      targetPort: null,
    };
  }
  const parsed = parsePackagerTarget(newest.url);
  return {
    available: true,
    bundleId,
    plistPath: appInfo.plistPath,
    targetUrl: newest.url,
    targetHost: parsed?.targetHost ?? null,
    targetPort: parsed?.targetPort ?? null,
    targetTimestamp: newest.timestamp,
  };
}

export function resetIosDevClientTarget(endpoint = resolveMetroEndpoint(), options = {}) {
  if (process.platform !== 'darwin') {
    return { ok: false, reason: 'not_macos' };
  }
  if (!bootedSimulatorUdid()) {
    return { ok: false, reason: 'no_booted_simulator' };
  }
  const bundleId = options.bundleId ?? IOS_BUNDLE_ID;
  const appInfo = simulatorAppInfo(bundleId);
  if (!appInfo) {
    return { ok: false, reason: 'app_not_installed', bundleId };
  }

  const packagerUrl = endpoint.packagerUrl ?? buildPackagerUrl(endpoint.deviceHost, endpoint.contractPort);
  const deepLink = endpoint.devClientDeepLink ?? buildDevClientDeepLink(packagerUrl, APP_SCHEME);
  const plist = readPlistJson(appInfo.plistPath);
  const registry = plist['expo.devlauncher.recentlyopenedapps'];
  const nextRegistry = {};
  const timestamp = Date.now();
  nextRegistry[packagerUrl] = {
    isEASUpdate: false,
    name: 'BlackStory (Dev)',
    timestamp,
    url: packagerUrl,
  };
  if (registry && typeof registry === 'object') {
    for (const [url, entry] of Object.entries(registry)) {
      const parsed = parsePackagerTarget(url);
      if (parsed?.targetPort === endpoint.contractPort && parsed.targetHost === endpoint.deviceHost) {
        continue;
      }
    }
  }
  plist['expo.devlauncher.recentlyopenedapps'] = nextRegistry;
  writePlistJson(appInfo.plistPath, plist);

  run('xcrun', ['simctl', 'openurl', 'booted', deepLink]);

  return {
    ok: true,
    bundleId,
    packagerUrl,
    deepLink,
    plistPath: appInfo.plistPath,
  };
}

export function iosClientMatchesEndpoint(clientTarget, endpoint) {
  if (!clientTarget?.available) {
    return true;
  }
  if (!clientTarget.targetPort) {
    return true;
  }
  return (
    clientTarget.targetPort === endpoint.contractPort &&
    clientTarget.targetHost === endpoint.deviceHost
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const mode = process.argv[2] ?? 'read';
  if (mode === 'read') {
    process.stdout.write(`${JSON.stringify(readIosDevClientTarget())}\n`);
    process.exit(0);
  }
  if (mode === 'reset') {
    const endpoint = resolveMetroEndpoint();
    const result = resetIosDevClientTarget(endpoint);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  if (mode === 'check') {
    const endpoint = resolveMetroEndpoint();
    const client = readIosDevClientTarget();
    const ok = iosClientMatchesEndpoint(client, endpoint);
    process.stdout.write(
      `${JSON.stringify({ ok, endpoint: endpoint.packagerUrl, client, bundleId: IOS_BUNDLE_ID })}\n`,
    );
    process.exit(ok ? 0 : 1);
  }
  console.error('Usage: ios-dev-client-target.mjs read|reset|check');
  process.exit(2);
}
