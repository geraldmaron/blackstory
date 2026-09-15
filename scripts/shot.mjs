/**
 * Headless screenshot helper for local UI verification.
 *
 * Drives a real Chrome over CDP (no extra dependencies: Node 22 ships a global WebSocket) so a
 * WebGL map plate actually paints. Usage:
 *
 *   node scripts/shot.mjs <outDir> <url> <label>:<width>x<height>[:click=<selector>] ...
 *
 * Each viewport spec produces `<outDir>/<label>.png`. `click=` presses a selector (and waits) after
 * load, which is how the armed browse posture is captured.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const [outDir, url, ...specs] = process.argv.slice(2);
if (!outDir || !url || specs.length === 0) {
  console.error('usage: node scripts/shot.mjs <outDir> <url> <label>:<w>x<h>[:click=sel] ...');
  process.exit(1);
}

const profile = join(tmpdir(), `bs-shot-${Date.now()}`);
const port = 9333 + Math.floor(Math.random() * 400);

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    '--use-angle=metal',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function wsUrl() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      const body = await response.json();
      if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
    } catch {
      // Chrome is still binding the port.
    }
    await sleep(250);
  }
  throw new Error('chrome did not expose a devtools endpoint');
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (entry) {
          this.pending.delete(message.id);
          message.error
            ? entry.reject(new Error(message.error.message))
            : entry.resolve(message.result);
        }
        return;
      }
      this.events.push(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

function connect(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    socket.addEventListener('open', () => resolve(new Cdp(socket)));
    socket.addEventListener('error', reject);
  });
}

try {
  const cdp = await connect(await wsUrl());
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await mkdir(outDir, { recursive: true });

  for (const spec of specs) {
    const [label, size, ...rest] = spec.split(':');
    const [width, height] = size.split('x').map(Number);
    const click = rest.find((part) => part.startsWith('click='))?.slice('click='.length);

    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 2, mobile: width < 600 },
      sessionId,
    );
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await sleep(6500);
    if (click) {
      await cdp.send(
        'Runtime.evaluate',
        { expression: `document.querySelector(${JSON.stringify(click)})?.click()` },
        sessionId,
      );
      await sleep(4000);
    }
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    await writeFile(join(outDir, `${label}.png`), Buffer.from(data, 'base64'));
    console.log(`wrote ${join(outDir, `${label}.png`)}`);
  }
} finally {
  chrome.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true });
}
